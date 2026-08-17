"use strict";

/**
 * 环境检测与自动安装：
 *   - checkEnv()     检测 node / npm / git / python / pip 是否存在及版本
 *   - installGit()   缺 git 时用 winget 自动装
 *   - installPython() 缺 python 时用 winget 自动装
 *   - downloadPortableNode(region) 下载便携 Node（给启动器用）
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { getNodeMirror } = require("./sources.js");

function run(cmd, args) {
  try {
    const res = spawnSync(cmd, args, { encoding: "utf8", shell: process.platform === "win32" });
    if (res.status === 0) return (res.stdout || "").trim();
    return null;
  } catch {
    return null;
  }
}

/** 检测环境；返回 { node, npm, git, python, pip }，每项 { ok, version? } */
function checkEnv() {
  const nodeVer = process.version;
  const npm = run("npm", ["--version"]);
  const git = run("git", ["--version"]);
  const python = run("python", ["--version"]) || run("py", ["--version"]);
  const pip = run("pip", ["--version"]);
  return {
    node: { ok: true, version: nodeVer, required: ">= 18" },
    npm: { ok: !!npm, version: npm },
    git: { ok: !!git, version: git },
    python: { ok: !!python, version: python },
    pip: { ok: !!pip, version: pip },
  };
}

/** 用 winget 安装（git / python 等）；返回是否成功 */
function installWithWinget(packageId) {
  const res = spawnSync(
    "winget",
    ["install", "--id", packageId, "--accept-source-agreements", "--accept-package-agreements", "-e"],
    { stdio: "inherit", shell: false }
  );
  return res.status === 0;
}

function installGit() {
  return installWithWinget("Git.Git");
}

function installPython() {
  return installWithWinget("Python.Python.3.12");
}

/**
 * 自动检测本机平台 + 架构，返回 Node 官方发布包信息。
 * platform/arch 可注入（默认取 process），便于测试所有组合。
 * 返回 { v, pkg, ext, unpack, exeName } 或 null（不支持的平台）。
 *   win32 → win-x64 / win-arm64（zip）
 *   darwin → darwin-x64 / darwin-arm64（tar.gz）
 *   linux → linux-x64 / linux-arm64 / linux-armv7l（tar.xz）
 */
function nodeBuild(version, platform = process.platform, arch = process.arch) {
  const v = version || "v22.23.2";
  if (platform === "win32") {
    const a = arch === "arm64" ? "arm64" : "x64";
    return { v, pkg: `node-${v}-win-${a}`, ext: "zip", unpack: "zip", exeName: "node.exe" };
  }
  if (platform === "darwin") {
    const a = arch === "arm64" ? "arm64" : "x64";
    return { v, pkg: `node-${v}-darwin-${a}`, ext: "tar.gz", unpack: "tar", exeName: "bin/node" };
  }
  if (platform === "linux") {
    const a = arch === "arm64" ? "arm64" : arch === "arm" ? "armv7l" : "x64";
    return { v, pkg: `node-${v}-linux-${a}`, ext: "tar.xz", unpack: "tar", exeName: "bin/node" };
  }
  return null;
}

/**
 * 下载便携 Node 并解压到目标目录，返回可执行文件路径或 null。
 * 自动检测平台/架构（win-x64 / win-arm64 / darwin-arm64 / linux-x64 ...）。
 * region: "cn" | "intl" —— 决定从 npmmirror 还是 nodejs.org 拉。
 */
async function downloadPortableNode(version, destDir, region) {
  const build = nodeBuild(version);
  if (!build) return null;
  const base = getNodeMirror(region);
  const archiveUrl = `${base}/${build.v}/${build.pkg}.${build.ext}`;
  const archivePath = path.join(os.tmpdir(), `${build.pkg}.${build.ext}`);
  const target = path.join(destDir, build.pkg);
  try {
    if (!fs.existsSync(archivePath)) {
      const res = await fetch(archiveUrl, { signal: AbortSignal.timeout(120000) });
      if (!res.ok) return null;
      fs.writeFileSync(archivePath, Buffer.from(await res.arrayBuffer()));
    }
    fs.mkdirSync(destDir, { recursive: true });
    let ok = false;
    if (build.unpack === "zip") {
      const r = spawnSync(
        "powershell.exe",
        ["-NoProfile", "-Command", `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`],
        { stdio: "ignore", shell: false }
      );
      ok = r.status === 0;
    } else {
      // tar.gz / tar.xz：用系统 tar（Windows 10+ / macOS / Linux 均自带）
      const r = spawnSync("tar", ["-xf", archivePath, "-C", destDir], { stdio: "ignore", shell: false });
      ok = r.status === 0;
    }
    if (!ok) {
      // 解压失败多半是缓存的压缩包损坏/不完整。删掉它，下次运行重新下载——
      // 否则损坏的缓存会被上面的 existsSync 永久信任，每次都失败
      try {
        fs.rmSync(archivePath, { force: true });
      } catch {}
      return null;
    }
    const exe = path.join(target, build.exeName);
    if (fs.existsSync(exe)) return exe;
    // 解压"成功"但找不到可执行文件：同样删掉缓存，避免死循环
    try {
      fs.rmSync(archivePath, { force: true });
    } catch {}
    return null;
  } catch {
    return null;
  }
}

module.exports = { checkEnv, installGit, installPython, downloadPortableNode, nodeBuild };

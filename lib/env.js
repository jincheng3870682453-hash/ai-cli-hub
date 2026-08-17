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
 * 下载便携 Node 并解压到目标目录，返回 node.exe 路径或 null。
 * region: "cn" | "intl" —— 决定从 npmmirror 还是 nodejs.org 拉。
 */
async function downloadPortableNode(version, destDir, region) {
  const v = version || "v22.23.2";
  const base = getNodeMirror(region);
  const pkg = `node-${v}-win-x64`;
  const zipUrl = `${base}/${v}/${pkg}.zip`;
  const zipPath = path.join(os.tmpdir(), `${pkg}.zip`);
  const target = path.join(destDir, pkg);
  try {
    if (!fs.existsSync(zipPath)) {
      const res = await fetch(zipUrl, { signal: AbortSignal.timeout(120000) });
      if (!res.ok) return null;
      fs.writeFileSync(zipPath, Buffer.from(await res.arrayBuffer()));
    }
    // 解压（PowerShell Expand-Archive）
    fs.mkdirSync(destDir, { recursive: true });
    const r = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-Command", `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`],
      { stdio: "ignore", shell: false }
    );
    if (r.status !== 0) return null;
    const exe = path.join(target, "node.exe");
    return fs.existsSync(exe) ? exe : null;
  } catch {
    return null;
  }
}

module.exports = { checkEnv, installGit, installPython, downloadPortableNode };

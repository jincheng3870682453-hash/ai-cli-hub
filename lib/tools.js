"use strict";

/**
 * 本地工具状态与安装执行：
 *   - hasCommand / whereBin  检测命令是否在 PATH 上（安装状态）
 *   - binVersion             运行 <bin> --version（带超时）
 *   - installTool            执行官方安装方式（npm -g 或 ps1 oneliner）
 *   - uninstallTool          卸载（仅 npm 类）
 *   - verifyTool             安装后验证（where + --version）
 */

const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const IS_WIN = process.platform === "win32";

/** 命令是否存在于 PATH */
function hasCommand(bin) {
  return whereBin(bin) !== null;
}

/** 返回命令的绝对路径，找不到返回 null（纯 PATH 扫描，不依赖子进程管道） */
function whereBin(bin) {
  if (!bin) return null;
  const exts = IS_WIN
    ? ["", ".exe", ".cmd", ".bat", ".ps1"]
    : [""];
  const dirs = (process.env.PATH || "").split(IS_WIN ? ";" : ":");
  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, bin + ext);
      try {
        if (fs.existsSync(candidate)) return candidate;
      } catch {
        /* 跳过不可访问目录 */
      }
    }
  }
  return null;
}

/** 运行 <bin> <args>，4 秒超时，返回首行输出；失败返回 null */
function binVersion(bin, args = ["--version"]) {
  if (!hasCommand(bin)) return null;
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(bin, args, { stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return resolve(null);
    }
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {}
      resolve(null);
    }, 4000);
    let out = "";
    child.stdout.on("data", (d) => {
      out += d;
      if (out.length > 2000) {
        clearTimeout(timer);
        try {
          child.kill();
        } catch {}
        resolve(out.trim().split(/\r?\n/)[0]);
      }
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve(out.trim().split(/\r?\n/)[0] || null);
    });
  });
}

/**
 * 执行安装。stream=true 时继承 stdio（交互菜单里让用户看到进度）。
 * 返回 { ok, message }。
 */
function installTool(tool, { stream = false } = {}) {
  const io = stream ? "inherit" : "pipe";
  if (tool.kind === "npm") {
    const res = spawnSync("npm", ["install", "-g", tool.pkg], {
      stdio: io,
      shell: IS_WIN,
    });
    return {
      ok: res.status === 0,
      message:
        res.status === 0
          ? `✅ npm install -g ${tool.pkg} 成功`
          : `❌ npm install -g ${tool.pkg} 失败（exit ${res.status}）`,
    };
  }
  if (tool.kind === "pip") {
    const res = spawnSync("pip", ["install", tool.pkg], {
      stdio: io,
      shell: IS_WIN,
    });
    return {
      ok: res.status === 0,
      message:
        res.status === 0
          ? `✅ pip install ${tool.pkg} 成功`
          : `❌ pip install ${tool.pkg} 失败（exit ${res.status}）`,
    };
  }
  if (tool.kind === "ps1-oneliner") {
    const cmd = `irm '${tool.onelinerUrl}' | iex`;
    const res = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
      { stdio: io, shell: false }
    );
    return {
      ok: res.status === 0,
      message:
        res.status === 0
          ? `✅ ${tool.name} 一行安装脚本执行完成`
          : `❌ ${tool.name} 安装脚本执行失败（exit ${res.status}）`,
    };
  }
  return { ok: false, message: `❌ 不支持的安装类型: ${tool.kind}` };
}

/** 卸载（仅 npm 类支持） */
function uninstallTool(tool, { stream = false } = {}) {
  if (tool.kind !== "npm") {
    return {
      ok: false,
      message: `⚠️ ${tool.name} 不是 npm 安装的，请手动卸载（或删除便携目录）`,
    };
  }
  const res = spawnSync("npm", ["uninstall", "-g", tool.pkg], {
    stdio: stream ? "inherit" : "pipe",
    shell: IS_WIN,
  });
  return {
    ok: res.status === 0,
    message:
      res.status === 0
        ? `✅ 已卸载 ${tool.pkg}`
        : `❌ 卸载失败（exit ${res.status}）`,
  };
}

/** 安装后验证：命令存在 + 版本号 */
async function verifyTool(tool) {
  const path_ = whereBin(tool.bin);
  if (!path_) {
    return { ok: false, message: `❌ 未找到命令 ${tool.bin}（不在 PATH 上）` };
  }
  const ver = await binVersion(tool.bin, tool.verifyArgs);
  return {
    ok: true,
    message: `✅ ${tool.bin} 可用${ver ? `（版本: ${ver}）` : ""}\n   路径: ${path_}`,
  };
}

module.exports = { hasCommand, whereBin, binVersion, installTool, uninstallTool, verifyTool };

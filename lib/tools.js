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
const { t } = require("./i18n.js");

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
 * installDir 非空时：npm 用 --prefix，pip 用 --prefix 安装到自定义路径。
 * 返回 { ok, message }。
 */
function installTool(tool, { stream = false, installDir = "" } = {}) {
  const io = stream ? "inherit" : "pipe";
  if (tool.kind === "npm") {
    const args = ["install", "-g", tool.pkg];
    if (installDir) args.push("--prefix", installDir);
    const res = spawnSync("npm", args, {
      stdio: io,
      shell: IS_WIN,
    });
    return {
      ok: res.status === 0,
      message:
        res.status === 0
          ? t("install_npm_ok", { pkg: tool.pkg })
          : t("install_npm_fail", { pkg: tool.pkg, code: res.status }),
    };
  }
  if (tool.kind === "pip") {
    const args = ["install", tool.pkg];
    if (installDir) args.push("--prefix", installDir);
    const res = spawnSync("pip", args, {
      stdio: io,
      shell: IS_WIN,
    });
    return {
      ok: res.status === 0,
      message:
        res.status === 0
          ? t("install_pip_ok", { pkg: tool.pkg })
          : t("install_pip_fail", { pkg: tool.pkg, code: res.status }),
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
          ? t("install_ps1_ok", { name: tool.name })
          : t("install_ps1_fail", { name: tool.name, code: res.status }),
    };
  }
  return { ok: false, message: t("install_unsupported", { kind: tool.kind }) };
}

/** 卸载（仅 npm 类支持） */
function uninstallTool(tool, { stream = false } = {}) {
  if (tool.kind !== "npm") {
    return {
      ok: false,
      message: t("uninstall_manual", { name: tool.name }),
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
        ? t("uninstall_ok", { pkg: tool.pkg })
        : t("uninstall_fail", { pkg: tool.pkg, code: res.status }),
  };
}

/** 安装后验证：命令存在 + 版本号 */
async function verifyTool(tool) {
  const path_ = whereBin(tool.bin);
  if (!path_) {
    return { ok: false, message: t("verify_not_found", { bin: tool.bin }) };
  }
  const ver = await binVersion(tool.bin, tool.verifyArgs);
  return {
    ok: true,
    message: `${t("verify_ok", { bin: tool.bin })}${ver ? t("verify_version", { ver }) : ""}\n   ${t("verify_path", { path: path_ })}`,
  };
}

module.exports = { hasCommand, whereBin, binVersion, installTool, uninstallTool, verifyTool };

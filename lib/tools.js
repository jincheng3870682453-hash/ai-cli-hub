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
const { getNpmRegistry, getPipIndex } = require("./sources.js");

const IS_WIN = process.platform === "win32";

/**
 * 检测当前 Python 主次版本（如 "3.13"）。优先 python，其次 py。
 * 都不可用时返回 null（未安装 / 无法探测）。
 * 必须 shell:false：Windows 上 shell:true 会经 cmd.exe 重组参数，
 * 把 `-c "import sys;..."` 拆成 `-c import` 导致 SyntaxError。
 * shell:false 直接 spawn exe，参数数组原样传递。
 */
function detectPythonVersion() {
  const code = "import sys;print(sys.version_info.major, sys.version_info.minor)";
  const probes = IS_WIN
    ? [
        ["python", ["-c", code]],
        ["py", ["-3", "-c", code]],
      ]
    : [
        ["python3", ["-c", code]],
        ["python", ["-c", code]],
      ];
  for (const [cmd, args] of probes) {
    try {
      const res = spawnSync(cmd, args, { encoding: "utf8", shell: false, timeout: 10000 });
      if (res.status === 0 && res.stdout) {
        const parts = res.stdout.trim().split(/\s+/);
        if (parts.length >= 2 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
          return `${parts[0]}.${parts[1]}`;
        }
      }
    } catch {
      /* 尝试下一种 */
    }
  }
  return null;
}

/**
 * 简单版本约束匹配：支持逗号分隔的多条件，如 ">=3.10,<3.13"。
 * 支持运算符: >= <= > < == != ~=。无法解析的约束直接视为满足（不阻断安装）。
 */
function versionSatisfies(ver, spec) {
  const num = (s) => {
    const parts = s.split(".").map((x) => parseInt(x, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return parts;
  };
  const cmp = (a, b) => {
    const A = num(a);
    const B = num(b);
    for (let i = 0; i < 3; i++) {
      if (A[i] !== B[i]) return A[i] < B[i] ? -1 : 1;
    }
    return 0;
  };
  return String(spec)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .every((cond) => {
      const m = cond.match(/^(<=|>=|==|!=|<|>|~=)?\s*(\d+(?:\.\d+){0,2})$/);
      if (!m) return true;
      const op = m[1] || "==";
      const c = cmp(ver, m[2]);
      if (op === ">=") return c >= 0;
      if (op === "<=") return c <= 0;
      if (op === ">") return c > 0;
      if (op === "<") return c < 0;
      if (op === "!=") return c !== 0;
      return c === 0;
    });
}

/**
 * 工具安装前的前置检查（pip 类的 Python 版本约束等）。
 * 返回 { ok, message? }；ok=false 时 message 为给用户看的失败原因。
 */
function checkPrereq(tool) {
  if (tool.kind === "pip" && tool.requiresPython) {
    const py = detectPythonVersion();
    if (!py) {
      return { ok: false, message: t("install_py_missing", { name: tool.name }) };
    }
    if (!versionSatisfies(py, tool.requiresPython)) {
      return {
        ok: false,
        message: t("install_py_unsupported", {
          name: tool.name,
          need: tool.requiresPython,
          have: py,
          hint: tool.pythonSuggestion || "",
        }),
      };
    }
  }
  return { ok: true };
}

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
      // Windows 上全局 npm 包的可执行文件是 .cmd shim，必须经 shell 启动，
      // 否则 spawn 直接 ENOENT，导致本地版本永远探测不到
      child = spawn(bin, args, { stdio: ["ignore", "pipe", "ignore"], shell: IS_WIN });
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
 * region 非空时：国内用 npmmirror / 清华 pip 镜像，国外用官方源。
 * 返回 { ok, message }。
 */
function installTool(tool, { stream = false, installDir = "", region = null } = {}) {
  const io = stream ? "inherit" : "pipe";
  if (tool.kind === "npm") {
    const args = ["install", "-g", tool.pkg];
    if (installDir) args.push("--prefix", installDir);
    if (region) args.push("--registry", getNpmRegistry(region));
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
    // 装前检查 Python 版本约束（如 aider 要求 <3.13，否则 pip 会静默回退旧版导致编译失败）
    const pre = checkPrereq(tool);
    if (!pre.ok) return pre;
    const args = ["install", tool.pkg];
    if (installDir) args.push("--prefix", installDir);
    if (region) args.push("-i", getPipIndex(region));
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

module.exports = {
  hasCommand,
  whereBin,
  binVersion,
  installTool,
  uninstallTool,
  verifyTool,
  detectPythonVersion,
  versionSatisfies,
  checkPrereq,
};

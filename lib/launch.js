"use strict";

/**
 * 一键启动：选模型 → 选已保存的 API Key → 选工具 → 带模型+Key 直接启动目标 CLI。
 * 启动前自动生成对应环境变量（OpenAI/Anthropic 兼容端点）或写入配置文件。
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { TOOLS } = require("../registry.js");
const { PROVIDERS, COMPAT_TARGETS } = require("./api.js");
const { loadKeys, maskKey } = require("./config.js");
const { t } = require("./i18n.js");
const { hasCommand, installTool } = require("./tools.js");
const { pick } = require("./wizard.js");

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
};
const paint = (code, s) => `${code}${s}${C.reset}`;
const pad = (s, n) => String(s).padEnd(n);

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 把 key/模型注入目标工具的环境变量（或配置文件） */
function buildLaunchEnv(tool, provider, key, model) {
  const target = COMPAT_TARGETS[tool.id];
  const values = {
    key,
    baseUrl: provider.baseUrl,
    baseUrlAnthropic: provider.anthropicCompat || provider.baseUrl,
    model,
  };
  if (target && target.kind === "env") {
    const env = {};
    for (const [k, tmpl] of target.env) {
      env[k] = tmpl.replace(/\{(\w+)\}/g, (_, n) => values[n] ?? "");
    }
    return { env };
  }
  if (target && target.kind === "file") {
    const file = target.file.startsWith("~")
      ? path.join(os.homedir(), target.file.slice(2))
      : path.resolve(target.file);
    const content = JSON.parse(
      JSON.stringify(target.template).replace(/\{(\w+)\}/g, (_, n) => values[n] ?? "")
    );
    return { file, content };
  }
  return {};
}

/** 启动目标 CLI（继承终端，退出后返回） */
function launchTool(tool, provider, key, model) {
  return new Promise((resolve) => {
    const prepared = buildLaunchEnv(tool, provider, key, model);
    if (prepared.file) {
      try {
        fs.mkdirSync(path.dirname(prepared.file), { recursive: true });
        fs.writeFileSync(prepared.file, JSON.stringify(prepared.content, null, 2));
      } catch (e) {
        console.log(paint(C.red, t("launch_failed", { msg: e.message, bin: tool.bin })));
        return resolve();
      }
    }
    const env = { ...process.env, ...(prepared.env || {}) };
    console.log(
      `\n${paint(C.bold + C.cyan, t("launch_starting", { tool: tool.name, model, provider: provider.name }))}`
    );
    console.log(paint(C.dim, t("launch_quit_hint", { bin: tool.bin })));
    // 把终端还给子进程（关掉我们的 raw 模式/按键监听）
    try {
      process.stdin.setRawMode(false);
    } catch {}
    process.stdin.removeAllListeners("keypress");
    const child = spawn(tool.bin, [], {
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", (e) => {
      console.log(paint(C.red, t("launch_failed", { msg: e.message, bin: tool.bin })));
      resolve();
    });
    child.on("close", () => {
      process.stdin.removeAllListeners("keypress");
      resolve();
    });
  });
}

/** 一键启动向导 */
async function runLaunch({ region }) {
  // ① 选模型（按提供商分组）
  const modelChoices = [];
  for (const p of PROVIDERS) {
    for (const m of p.models) modelChoices.push({ provider: p, model: m });
  }
  const sel = await pick(modelChoices, {
    title: t("launch_step1"),
    renderItem: (it) => `${pad(it.provider.name, 24)} ${it.model}`,
  });
  if (!sel) return false;

  // ② 选 API Key（该提供商已保存的）
  const keys = loadKeys();
  const savedKey = keys[sel.provider.id]?.key;
  if (!savedKey) {
    console.log(paint(C.yellow, t("launch_no_key", { provider: sel.provider.name })));
    await wait(1800);
    return false;
  }
  console.log(paint(C.green, t("launch_key_using", { provider: sel.provider.name, masked: maskKey(savedKey) })));
  await wait(700);

  // ③ 选工具
  const tool = await pick(TOOLS, {
    title: t("launch_step3"),
    renderItem: (tool) => {
      const st = hasCommand(tool.bin) ? paint(C.green, "✓ 已装") : paint(C.dim, "✗ 未装");
      return `${pad(tool.name, 22)} ${st}`;
    },
  });
  if (!tool) return false;

  // ④ 未装先下载
  if (!hasCommand(tool.bin)) {
    console.log(paint(C.cyan, t("launch_installing", { tool: tool.name })));
    const res = installTool(tool, { stream: true, region });
    console.log(res.message);
  }

  // ⑤ 一键启动
  await launchTool(tool, sel.provider, savedKey, sel.model);
  return true;
}

module.exports = { runLaunch, buildLaunchEnv };

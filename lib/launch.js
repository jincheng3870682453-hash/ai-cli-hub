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
const { pick, promptKeys } = require("./wizard.js");

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
    providerId: provider.id,
    providerName: provider.name,
  };
  if (target && target.kind === "env") {
    const env = {};
    for (const [k, tmpl] of target.env) {
      env[k] = tmpl.replace(/\{(\w+)\}/g, (_, n) => values[n] ?? "");
    }
    const out = { env };
    // 带 cliOverrides 的目标（如 Codex）：生成 -c key=value 启动参数，
    // 强制覆盖目标自身的 config，避免请求被发到错误的 provider
    if (target.cliOverrides) {
      const fill = (s) => s.replace(/\{(\w+)\}/g, (_, n) => values[n] ?? "");
      out.args = target.cliOverrides.flatMap(([k, v]) => ["-c", `${fill(k)}=${fill(v)}`]);
    }
    return out;
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
    // 启动参数：cliOverrides（-c 覆盖）优先；否则把选中的模型传给工具（--model）
    const target = COMPAT_TARGETS[tool.id];
    const args = prepared.args ?? (target && target.modelArg ? target.modelArg : []).map((a) =>
      a.replace(/\{(\w+)\}/g, (_, n) => ({ model })[n] ?? a)
    );
    console.log(
      `\n${paint(C.bold + C.cyan, t("launch_starting", { tool: tool.name, model, provider: provider.name }))}`
    );
    console.log(paint(C.dim, t("launch_quit_hint", { bin: tool.bin })));
    if (args.length) console.log(paint(C.dim, `  参数: ${tool.bin} ${args.join(" ")}`));
    // 把终端完全交给子进程：关 raw、移除我们的 keypress/data 监听，停止 stdin 流动
    try {
      process.stdin.setRawMode(false);
    } catch {}
    process.stdin.removeAllListeners("keypress");
    process.stdin.removeAllListeners("data");
    try {
      process.stdin.pause();
    } catch {}
    const child = spawn(tool.bin, args, {
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", (e) => {
      console.log(paint(C.red, t("launch_failed", { msg: e.message, bin: tool.bin })));
      resolve();
    });
    child.on("close", () => {
      // 收回终端，恢复按键监听
      try {
        process.stdin.resume();
      } catch {}
      process.stdin.removeAllListeners("keypress");
      process.stdin.removeAllListeners("data");
      readlineEmit();
      resolve();
    });
  });
}

/** 重新初始化 keypress（启动子进程时被移除） */
function readlineEmit() {
  try {
    const readline = require("node:readline");
    readline.emitKeypressEvents(process.stdin);
  } catch {}
}

/** 一键启动向导：① 选已配置的 Key（提供商）→ ② 选该提供商的模型 → ③ 选工具 → 启动 */
async function runLaunch({ region }) {
  const keys = loadKeys();

  // ① 选 API Key：只列出已配置 key 的提供商
  const configured = PROVIDERS.filter((p) => keys[p.id]?.key);
  if (configured.length === 0) {
    console.log(paint(C.yellow, t("launch_no_keys")));
    await wait(1800);
    return false;
  }
  const provider = await pick(configured, {
    title: t("launch_step1"),
    renderItem: (p) => `${pad(p.name, 24)} ${paint(C.green, "🔑 " + maskKey(keys[p.id].key))}`,
  });
  if (!provider) return false;
  const savedKey = keys[provider.id].key;
  console.log(paint(C.green, t("launch_key_using", { provider: provider.name, masked: maskKey(savedKey) })));

  // ② 选模型（该提供商的模型目录 + 自定义输入）
  const custom = t("wiz_custom_model");
  const model = await pick([...provider.models, custom], {
    title: t("launch_step2", { provider: provider.name }),
    renderItem: (m) => m,
  });
  if (!model) return false;
  let modelName = model;
  if (model === custom) {
    const entered = await promptKeys(t("wiz_custom_model_prompt") + " ", { mask: false });
    const name = (entered && entered.trim()) || provider.models[0];
    // 启动参数经 cmd shell 拼接（DEP0190：不做转义），模型名必须白名单校验
    if (!/^[\w.\-/:]+$/.test(name)) {
      console.log(paint(C.red, t("launch_bad_model")));
      await wait(1500);
      return false;
    }
    modelName = name;
  }

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
  await launchTool(tool, provider, savedKey, modelName);
  return true;
}

module.exports = { runLaunch, buildLaunchEnv };

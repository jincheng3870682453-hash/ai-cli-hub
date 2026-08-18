"use strict";

/**
 * 引导配置向导：三步走，零门槛接任意工具。
 *   ① 选 API Key 提供商 → ② 输入/复用 key（DPAPI 加密保存）→ ③ 选模型
 *   → ④ 选工具 → ⑤ 未装自动下载（区域源）→ ⑥ 自动生成兼容配置
 *
 * 适配哲学：任何公司的 key 都能尝试接任何工具——
 *   兼容组合 → 直接生成配置；不兼容组合 → 明确提示 + 给官方文档/替代方案，
 *   不让你卡住。
 */

const readline = require("node:readline");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { TOOLS } = require("../registry.js");
const {
  PROVIDERS,
  COMPAT_TARGETS,
  buildCompat,
  targetSupportsProvider,
} = require("./api.js");
const { loadKeys, saveKeys, maskKey, loadConfig, saveConfig } = require("./config.js");
const { t } = require("./i18n.js");
const { hasCommand, installTool } = require("./tools.js");
const { getNpmRegistry, getPipIndex } = require("./sources.js");

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
};
const paint = (code, s) => `${code}${s}${C.reset}`;
const pad = (s, n) => String(s).padEnd(n);

function setRaw(on) {
  try {
    process.stdin.setRawMode(on);
  } catch {}
}

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

/** 单次按键（临时 raw 模式） */
function keypressOnce() {
  return new Promise((resolve) => {
    const handler = (_str, key) => {
      process.stdin.removeListener("keypress", handler);
      setRaw(false);
      resolve(key);
    };
    process.stdin.on("keypress", handler);
    setRaw(true);
  });
}

/** 方向键选择列表；返回选中项或 null（Esc/q 返回） */
async function pick(items, { title, renderItem }) {
  let sel = 0;
  const draw = () => {
    clearScreen();
    console.log(`\n${paint(C.bold + C.cyan, title)}\n`);
    items.forEach((it, i) => {
      console.log(` ${i === sel ? paint(C.cyan + C.bold, "❯") : " "} ${renderItem(it, i)}`);
    });
    console.log(`\n${paint(C.dim, "↑/↓ 选择 · 数字直选 · Enter 确认 · Esc/q 返回")}`);
  };
  draw();
  for (;;) {
    const k = await keypressOnce();
    if (k.name === "up") sel = (sel - 1 + items.length) % items.length;
    else if (k.name === "down") sel = (sel + 1) % items.length;
    else if (k.name === "return") return items[sel];
    else if (k.name === "escape" || k.name === "q" || (k.ctrl && (k.name === "c" || k.name === "q"))) return null;
    else if (/^[1-9]$/.test(k.sequence || "") && items[Number(k.sequence) - 1]) return items[Number(k.sequence) - 1];
    draw();
  }
}

/** 读剪贴板（Windows PowerShell Get-Clipboard）；失败返回 null */
function readClipboard() {
  try {
    const r = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-Command", "Get-Clipboard -Raw"],
      { encoding: "utf8", shell: false, timeout: 8000 }
    );
    if (r.status === 0 && r.stdout) return r.stdout.replace(/\r?\n$/, "");
  } catch {}
  return null;
}

/**
 * 手动按键输入（raw 模式）：方向键/回车/Ctrl 键全部可控。
 * mask=true 时不回显（输 API Key 用）；Ctrl+C / Ctrl+Q / Esc 取消（返回 null）。
 * 支持粘贴：Ctrl+V（读剪贴板）、终端右键/Shift+Insert 粘贴、bracketed paste 序列。
 */
function promptKeys(question, { mask = true } = {}) {
  return new Promise((resolve) => {
    setRaw(true);
    let buf = "";
    let inPaste = false; // bracketed paste 中
    const draw = () => {
      const shown = mask ? "*".repeat(buf.length) : buf;
      process.stdout.write("\r\x1b[K" + question + shown);
    };
    const finish = (v) => {
      process.stdin.removeListener("keypress", handler);
      setRaw(false);
      process.stdout.write("\n");
      resolve(v);
    };
    const handler = (_str, key) => {
      if (key.ctrl && (key.name === "c" || key.name === "q")) return finish(null); // Ctrl+C / Ctrl+Q 取消
      if (key.name === "escape") return finish(null);
      if (key.name === "return") return finish(buf);
      if (key.name === "backspace") {
        buf = buf.slice(0, -1);
        return draw();
      }
      const seq = key.sequence || "";
      // bracketed paste 开始/结束（\x1b[200~ ... \x1b[201~）
      if (seq === "\x1b[200~") {
        inPaste = true;
        return;
      }
      if (seq === "\x1b[201~") {
        inPaste = false;
        return draw();
      }
      // Ctrl+V：直接读剪贴板插入（很多终端 raw 模式下不会自动粘贴）
      if (key.ctrl && key.name === "v") {
        const clip = readClipboard();
        if (clip) {
          buf += clip;
          draw();
        }
        return;
      }
      // 其他转义序列忽略（防粘贴标记残留）
      if (seq.startsWith("\x1b")) return;
      if (inPaste) {
        buf += seq; // bracketed paste 内容原样追加
        return draw();
      }
      if (seq && !key.ctrl && !key.meta && seq.length === 1 && seq >= " " && seq !== "\x7f") {
        buf += seq;
      }
      draw();
    };
    process.stdin.on("keypress", handler);
    draw();
  });
}

/** 掩码输入（不回显明文） */
function promptSecret(question) {
  return promptKeys(question + " ", { mask: true });
}

/** 普通输入（可回显） */
function promptLine(question) {
  return promptKeys(question + " ", { mask: false });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 运行向导。
 * opts: { region } —— 已检测的网络区域（国内/国外）
 */
async function runWizard({ region }) {
  const keys = loadKeys();

  // ── ① 选提供商 ──
  const provider = await pick(PROVIDERS, {
    title: t("wiz_step1_title"),
    renderItem: (p) => {
      const k = keys[p.id]?.key;
      return `${pad(p.name, 26)}${k ? paint(C.green, `[${t("api_configured", { masked: maskKey(k) })}]`) : paint(C.dim, `[${t("api_no_key")}]`)}  ${paint(C.dim, p.consoleUrl)}`;
    },
  });
  if (!provider) return false;

  // ── ② 输入 / 复用 key ──
  let key = keys[provider.id]?.key;
  if (!key) {
    const entered = await promptSecret(t("wiz_key_prompt", { provider: provider.name }) + "\n");
    if (!entered) {
      console.log(paint(C.yellow, t("wiz_key_empty")));
      await wait(1200);
      return false;
    }
    key = entered;
    const all = loadKeys();
    all[provider.id] = { key, addedAt: new Date().toISOString() };
    saveKeys(all);
    console.log(paint(C.green, t("wiz_key_saved", { masked: maskKey(key) })));
  } else {
    console.log(paint(C.dim, t("wiz_key_use_existing", { masked: maskKey(key) })));
  }
  await wait(800);

  // ── ③ 选模型 ──
  const custom = t("wiz_custom_model");
  const model = await pick([...provider.models, custom], {
    title: t("wiz_step3_title", { provider: provider.name }),
    renderItem: (m) => m,
  });
  if (!model) return false;
  const modelName = model === custom ? await promptLine(t("wiz_custom_model_prompt") + " ") || provider.models[0] : model;

  // ── ④ 选工具 ──
  const tool = await pick(TOOLS, {
    title: t("wiz_step4_title", { model: modelName }),
    renderItem: (tool) => {
      const st = hasCommand(tool.bin) ? paint(C.green, `✓ ${t("info_installed")}`) : paint(C.dim, `✗ ${t("info_not_installed")}`);
      const support = targetSupportsProvider(tool.id, provider);
      const warn = support.ok ? "" : paint(C.yellow, `⚠ ${support.reason === "protocol" ? t("wiz_warn_protocol") : support.reason === "only" ? t("wiz_warn_only") : ""}`);
      return `${pad(tool.name, 22)}${st}  ${warn}`;
    },
  });
  if (!tool) return false;

  // ── ⑤ 安装位置（可选，回车=默认）──
  const cfg = loadConfig();
  if (!cfg.installDir) {
    const loc = await promptKeys(t("wiz_install_loc_prompt"), { mask: false });
    if (loc) {
      cfg.installDir = path.resolve(loc);
      saveConfig(cfg);
      console.log(paint(C.green, t("config_install_dir_set", { dir: cfg.installDir })));
      await wait(800);
    }
  }

  // ── ⑥ 未安装则自动下载（区域源 + 自定义路径）──
  if (!hasCommand(tool.bin)) {
    console.log(paint(C.cyan, t("wiz_installing", { name: tool.name })));
    const res = installTool(tool, { stream: true, installDir: cfg.installDir || "", region });
    console.log(res.message);
    if (!res.ok) {
      console.log(paint(C.yellow, t("wiz_install_failed_abort", { name: tool.name })));
      await wait(2000);
      return false;
    }
  } else {
    console.log(paint(C.dim, t("wiz_already_installed", { name: tool.name })));
  }

  // ── ⑦ 生成兼容配置 ──
  clearScreen();
  console.log(`\n${paint(C.bold + C.cyan, t("wiz_result_title"))}\n`);
  console.log(`  ${t("wiz_result_provider")} ${paint(C.bold, provider.name)}  (${provider.consoleUrl})`);
  console.log(`  ${t("wiz_result_model")}   ${paint(C.bold, modelName)}`);
  console.log(`  ${t("wiz_result_tool")}    ${paint(C.bold, tool.name)}`);

  const support = targetSupportsProvider(tool.id, provider);
  const compat = buildCompat(tool.id, provider.id, modelName);

  if (!support.ok && !compat) {
    console.log(`\n${paint(C.yellow, t("wiz_compat_unsupported"))}`);
    if (COMPAT_TARGETS[tool.id]?.docs) console.log(`  ${t("info_homepage")} ${COMPAT_TARGETS[tool.id].docs}`);
    if (support.reason === "protocol") {
      console.log(paint(C.dim, t("wiz_hint_openrouter")));
    }
    console.log(paint(C.dim, t("wiz_compat_manual")));
  } else if (compat && compat.kind === "env") {
    try {
      fs.mkdirSync(path.dirname(compat.file), { recursive: true });
      fs.writeFileSync(compat.file, compat.lines.join("\n") + "\n");
    } catch (e) {
      console.log(paint(C.red, `❌ ${e.message}`));
      return false;
    }
    console.log(`\n${paint(C.green, t("wiz_compat_generated"))}`);
    console.log(`  ${t("compat_env_file", { file: compat.file })}`);
    for (const line of compat.lines) console.log(`    ${paint(C.cyan, line)}`);
    console.log(`\n  ${paint(C.dim, t("wiz_apply_cmd", { file: compat.file }))}`);
    if (compat.command) console.log(`  ${paint(C.cyan, t("compat_command", { cmd: compat.command }))}`);
    if (COMPAT_TARGETS[tool.id]?.note) console.log(`  ${paint(C.dim, COMPAT_TARGETS[tool.id].note)}`);
    if (COMPAT_TARGETS[tool.id]?.docs) console.log(`  ${t("info_homepage")} ${COMPAT_TARGETS[tool.id].docs}`);
  } else if (compat && compat.kind === "file") {
    try {
      const target = compat.file;
      if (fs.existsSync(target)) {
        fs.copyFileSync(target, `${target}.bak`);
        console.log(`  ${paint(C.yellow, t("wiz_backup_written", { file: `${target}.bak` }))}`);
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(compat.content, null, 2));
    } catch (e) {
      console.log(paint(C.red, `❌ ${e.message}`));
      return false;
    }
    console.log(`\n${paint(C.green, t("wiz_compat_generated"))}`);
    console.log(`  ${t("compat_written", { file: compat.file })}`);
    if (COMPAT_TARGETS[tool.id]?.docs) console.log(`  ${t("info_homepage")} ${COMPAT_TARGETS[tool.id].docs}`);
  } else {
    // kind === "cmd"
    const c = COMPAT_TARGETS[tool.id];
    // 走内建网关的厂商（GLM/Kimi 等）：网关端口运行时动态分配，静态命令无法预知 → 提示走一键启动
    if (compat.needsGateway) {
      console.log(
        `\n${paint(C.cyan, t("compat_needs_gateway", { provider: provider.name }))}`
      );
      if (COMPAT_TARGETS[tool.id]?.docs)
        console.log(`  ${t("info_homepage")} ${COMPAT_TARGETS[tool.id].docs}`);
    }
    // 厂商使用自有协议、内建网关也无法转换 → 明确提示，不打印必然失败的命令
    else if (compat.blocked) {
      console.log(`\n${paint(C.red, t("launch_blocked", { tool: tool.name, provider: provider.name }))}`);
      console.log(paint(C.yellow, compat.blocked.reason));
      console.log(paint(C.dim, t("launch_blocked_hint")));
    } else {
      console.log(`\n${paint(C.green, t("wiz_compat_cmd"))}`);
      console.log(`  ${paint(C.cyan, `  ${c.cmd}`)}`);
      if (c.note) console.log(`  ${paint(C.dim, c.note)}`);
    }
    if (c.docs) console.log(`  ${t("info_homepage")} ${c.docs}`);
  }

  console.log(`\n${paint(C.dim, t("wiz_done"))}`);
  await wait(1500);
  return true;
}

module.exports = { runWizard, promptKeys, pick };

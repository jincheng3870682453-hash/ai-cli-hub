#!/usr/bin/env node
"use strict";

/**
 * AI CLI 安装平台 — 终端菜单程序
 *
 * 用法：
 *   node index.js                   交互式菜单（方向键选择、回车安装）
 *   node index.js --list            列出工具与安装状态
 *   node index.js --refresh         拉取全部工具最新版本
 *   node index.js --info <id>       查看单个工具详情
 *   node index.js --install <id>    非交互安装
 *   node index.js --verify <id>     验证安装
 *   node index.js --uninstall <id>  卸载（先自动备份数据到 backups/，--no-backup 跳过）
 */

const readline = require("node:readline");
const fs = require("node:fs");
const path = require("node:path");
const { TOOLS, BY_ID } = require("./registry.js");
const { refreshAll, cachedAll } = require("./lib/versions.js");
const {
  hasCommand,
  whereBin,
  binVersion,
  installTool,
  uninstallTool,
  verifyTool,
} = require("./lib/tools.js");
const { backupTool } = require("./lib/backup.js");
const { C, paint, pad, buildFrame, renderDiff } = require("./lib/frame.js");

const TTY = process.stdout.isTTY;

/** 熊猫 logo（原创 ASCII 吉祥物，见 assets/logo.txt） */
let LOGO = "";
try {
  LOGO = fs.readFileSync(path.join(__dirname, "assets", "logo.txt"), "utf8").replace(/\n$/, "");
} catch {
  LOGO = "🐼";
}

/* ─────────────────────────── CLI 模式 ─────────────────────────── */

async function cliList(args) {
  const useCache = args.includes("--offline");
  const versions = useCache ? cachedAll(TOOLS) : await refreshAll(TOOLS);
  console.log(paint(C.cyan, LOGO));
  console.log(paint(C.bold + C.cyan, "\nAI CLI 安装平台 — 工具清单\n"));
  for (const tool of TOOLS) {
    const v = versions[tool.id];
    const installed = hasCommand(tool.bin);
    const mark = installed ? paint(C.green, "✓ 已装") : paint(C.dim, "✗ 未装");
    const latest = v
      ? `${v.version}${v.offline ? paint(C.yellow, " (缓存)") : ""}`
      : paint(C.red, "未知(离线)");
    console.log(
      `  ${pad(tool.id, 14)} ${mark}  ${pad(tool.name, 22)} 最新:${pad(latest, 18)} ${paint(
        C.dim,
        tool.vendor
      )}`
    );
  }
  console.log(
    `\n${paint(C.dim, "交互模式: node index.js  |  离线快速列表: node index.js --list --offline")}\n`
  );
}

async function cliRefresh() {
  console.log(paint(C.cyan, "正在从官方源拉取版本信息..."));
  const versions = await refreshAll(TOOLS);
  for (const tool of TOOLS) {
    const v = versions[tool.id];
    if (v) {
      console.log(
        `  ${pad(tool.id, 14)} ${pad(v.version, 12)} ${v.offline ? paint(C.yellow, "(缓存)") : paint(C.green, "✓ 已更新")}  ${v.source}`
      );
    } else {
      console.log(`  ${pad(tool.id, 14)} ${paint(C.red, "拉取失败(离线)")}`);
    }
  }
}

async function cliInfo(id) {
  const tool = BY_ID.get(id);
  if (!tool) return fail(`未知工具: ${id}（可用: ${TOOLS.map((t) => t.id).join(", ")}）`);
  const versions = await refreshAll([tool]);
  const v = versions[id];
  const installed = hasCommand(tool.bin);
  console.log(`\n${paint(C.bold + C.cyan, tool.name)}  ${paint(C.dim, tool.vendor)} ${paint(C.magenta, `[${tool.tag}]`)}`);
  console.log(`  kind:      ${tool.kind === "npm" ? `npm · ${tool.pkg}` : tool.kind === "pip" ? `pip · ${tool.pkg}` : `ps1-oneliner · ${tool.repo}`}`);
  console.log(`  命令:      ${tool.bin} ${(tool.verifyArgs || []).join(" ")}`);
  console.log(`  最新版本:  ${v ? v.version + (v.offline ? " (缓存)" : "") : "未知(离线)"}`);
  console.log(`  安装状态:  ${installed ? paint(C.green, "已安装") + (whereBin(tool.bin) ? ` @ ${whereBin(tool.bin)}` : "") : paint(C.dim, "未安装")}`);
  if (tool.dataDirs && tool.dataDirs.length) {
    console.log(`  数据目录:  ${tool.dataDirs.map((d) => d.path).join(", ")}（卸载前自动备份）`);
  }
  if (tool.homepage) console.log(`  官网:      ${tool.homepage}`);
  console.log(`  说明:      ${tool.note}\n`);
}

async function cliInstall(id) {
  const tool = BY_ID.get(id);
  if (!tool) return fail(`未知工具: ${id}`);
  if (hasCommand(tool.bin)) {
    console.log(paint(C.yellow, `⚠️ ${tool.bin} 已在 PATH 上，跳过安装。`));
    return;
  }
  console.log(paint(C.cyan, `开始安装 ${tool.name} ...`));
  const res = installTool(tool, { stream: true });
  console.log(res.message);
  const v = await verifyTool(tool);
  console.log(v.message);
}

async function cliVerify(id) {
  const tool = BY_ID.get(id);
  if (!tool) return fail(`未知工具: ${id}`);
  const v = await verifyTool(tool);
  console.log(v.message);
}

/**
 * 卸载前备份数据；返回 true 可继续卸载，false 应中止。
 * 备份失败（如文件占用/权限）不会硬崩，而是中止卸载保护数据。
 */
function backupBeforeUninstall(tool, { quiet = false } = {}) {
  if (!tool.dataDirs || tool.dataDirs.length === 0) {
    if (!quiet) console.log(paint(C.dim, `ℹ️ ${tool.name} 未登记用户数据目录，跳过备份。`));
    return true;
  }
  let result;
  try {
    result = backupTool(tool);
  } catch (e) {
    console.log(paint(C.red, `❌ 备份 ${tool.name} 数据失败: ${e.message}`));
    console.log(paint(C.yellow, "   为保护你的数据，已中止卸载。可手动备份后重试（或 --no-backup 跳过）。"));
    return false;
  }
  if (result.saved.length === 0) {
    if (!quiet) {
      console.log(paint(C.dim, `ℹ️ 未发现 ${tool.name} 的用户数据（已检查: ${result.missing.join(", ")}），无需备份。`));
    }
    return true;
  }
  console.log(paint(C.cyan, `📦 已备份 ${tool.name} 的用户数据 → ${result.dest}`));
  for (const s of result.saved) {
    console.log(`   ✓ ${s.path}${s.note ? `（${s.note}）` : ""}`);
  }
  console.log(paint(C.yellow, "   ⚠️ 备份包含配置/凭证，请妥善保管，用完可删除。"));
  return true;
}

async function cliUninstall(id, args) {
  const tool = BY_ID.get(id);
  if (!tool) return fail(`未知工具: ${id}`);
  const noBackup = args.includes("--no-backup");
  if (!hasCommand(tool.bin)) {
    console.log(paint(C.yellow, `⚠️ ${tool.bin} 未在 PATH 上，可能未安装或已是便携版，跳过卸载。`));
    return;
  }
  if (!noBackup) {
    if (!backupBeforeUninstall(tool)) return;
  }
  const res = uninstallTool(tool, { stream: true });
  console.log(res.message);
}

function fail(msg) {
  console.error(paint(C.red, msg));
  process.exitCode = 1;
}

/**
 * 卸载确认决策（w/n 制，防误触）：
 *   - Ctrl+C / Esc    → "exit"/"cancel" 退出或取消（特殊键，不提醒）
 *   - 小写 w          → "confirm" 确认卸载
 *   - 小写 n          → "cancel"  取消卸载
 *   - 其他任何输入     → "remind"  仅提醒一次「请按 w 或者 n」，不做任何事
 */
function decideConfirm(key) {
  if (key.ctrl && key.name === "c") return "exit";
  const seq = key.sequence ?? "";
  if (seq === "\u001b") return "cancel"; // Esc
  if (seq === "w") return "confirm";
  if (seq === "n") return "cancel";
  return "remind";
}

module.exports = { decideConfirm };

/* ─────────────────────────── 交互模式 ─────────────────────────── */

async function interactive() {
  if (!process.stdin.isTTY) {
    console.error(
      paint(C.yellow, "⚠️ 交互模式需要 TTY 终端。非交互场景请用 --list / --install <id> 等参数。")
    );
    process.exit(1);
  }

  const HIDE_CURSOR = "\x1b[?25l";
  const SHOW_CURSOR = "\x1b[?25h";

  // 1. 拉版本（失败自动用缓存）
  process.stdout.write(paint(C.cyan, "正在从官方源拉取版本信息...\n"));
  let versions = await refreshAll(TOOLS);
  readline.cursorTo(process.stdout, 0);
  readline.clearLine(process.stdout, 0);
  if (Object.values(versions).every((v) => v === null)) {
    versions = cachedAll(TOOLS);
    if (Object.values(versions).every((v) => v === null)) {
      console.log(paint(C.yellow, "⚠️ 完全离线，版本显示为「未知」。"));
    } else {
      console.log(paint(C.yellow, "⚠️ 网络不可达，使用缓存版本信息。"));
    }
  }

  let selected = 0;
  let busy = false;
  let pendingConfirm = null; // { tool, resolve }
  let statusCache = new Map();
  let frameRows = []; // 上一帧的行，用于增量重绘

  const refreshStatus = async () => {
    await Promise.all(
      TOOLS.map(async (t) => {
        const installed = hasCommand(t.bin);
        const version = installed ? await binVersion(t.bin, t.verifyArgs) : null;
        statusCache.set(t.id, { installed, version });
      })
    );
  };

  /** 生成一帧文本行（基于 frame 模块的纯函数） */
  const buildRows = () =>
    buildFrame({
      tools: TOOLS,
      versions,
      statusCache,
      selected,
      busy,
      pendingConfirm,
      logo: LOGO,
    });

  /** 行级增量重绘：只更新变化的行，避免整屏清空导致的卡顿 */
  const paintFrame = () => {
    const { out, rows } = renderDiff(frameRows, buildRows());
    if (out) process.stdout.write(out);
    frameRows = rows;
  };

  /** 整屏重建：子进程/日志输出导致终端滚动后必须用这个恢复帧布局 */
  const fullRender = () => {
    process.stdout.write("\x1b[2J\x1b[H");
    frameRows = [];
    paintFrame();
  };

  /** 临时退出 raw 模式让子进程读输入，结束后恢复 */
  const runChild = async (fn) => {
    process.stdin.setRawMode(false);
    try {
      await fn();
    } finally {
      process.stdin.setRawMode(true);
    }
  };

  const doInstall = async (tool) => {
    if (hasCommand(tool.bin)) {
      console.log(paint(C.yellow, `⚠️ ${tool.bin} 已在 PATH 上，跳过安装。`));
      await new Promise((r) => setTimeout(r, 1200));
      fullRender();
      return;
    }
    busy = true;
    fullRender();
    await runChild(() => {
      console.log(paint(C.cyan, `\n开始安装 ${tool.name} ...`));
      const res = installTool(tool, { stream: true });
      console.log(res.message);
    });
    busy = false;
    await refreshStatus();
    fullRender();
  };

  const doVerify = async (tool) => {
    busy = true;
    fullRender();
    await runChild(async () => {
      const v = await verifyTool(tool);
      console.log(v.message);
    });
    busy = false;
    fullRender();
  };

  const doUninstall = async (tool) => {
    // 先备份（失败则中止，保护数据）
    if (!backupBeforeUninstall(tool)) {
      fullRender();
      return;
    }
    fullRender();
    if (tool.kind !== "npm") {
      console.log(paint(C.yellow, `⚠️ ${tool.name} 不是 npm 安装的，请手动卸载（或删除便携目录）。`));
      await new Promise((r) => setTimeout(r, 1500));
      fullRender();
      return;
    }
    // 按键式确认（raw 模式下直接收 y/n，避免 readline 冲突）
    const answer = await new Promise((resolve) => {
      pendingConfirm = { tool, resolve };
      paintFrame();
    });
    pendingConfirm = null;
    if (!answer) {
      console.log(paint(C.yellow, "✋ 已取消卸载（未执行任何卸载）。"));
      fullRender();
      return;
    }
    busy = true;
    fullRender();
    await runChild(() => {
      const res = uninstallTool(tool, { stream: true });
      console.log(res.message);
    });
    busy = false;
    await refreshStatus();
    fullRender();
  };

  const doInfo = async (tool) => {
    busy = true;
    fullRender();
    await runChild(() => {
      const v = versions[tool.id];
      console.log(`\n${paint(C.bold + C.cyan, tool.name)}  ${paint(C.dim, tool.vendor)} ${paint(C.magenta, `[${tool.tag}]`)}`);
      console.log(`  命令:     ${tool.bin}`);
      console.log(`  最新版本: ${v ? v.version + (v.offline ? " (缓存)" : "") : "未知(离线)"}`);
      if (tool.dataDirs && tool.dataDirs.length) {
        console.log(`  数据目录: ${tool.dataDirs.map((d) => d.path).join(", ")}（卸载前自动备份）`);
      }
      if (tool.homepage) console.log(`  官网:     ${tool.homepage}`);
      console.log(`  说明:     ${tool.note}\n`);
    });
    busy = false;
    fullRender();
  };

  const doRefresh = async () => {
    busy = true;
    fullRender();
    await runChild(async () => {
      console.log(paint(C.cyan, "\n正在重新拉取版本..."));
      versions = await refreshAll(TOOLS);
      console.log(paint(C.green, "✅ 版本信息已更新"));
    });
    busy = false;
    fullRender();
  };

  const exit = () => {
    try {
      process.stdin.setRawMode(false);
    } catch {}
    process.stdout.write("\x1b[2J\x1b[H" + SHOW_CURSOR);
    console.log(paint(C.dim, "再见 👋"));
    process.exit(0);
  };
  process.on("exit", () => process.stdout.write(SHOW_CURSOR));

  await refreshStatus();
  process.stdout.write("\x1b[2J\x1b[H" + HIDE_CURSOR);
  paintFrame();

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on("keypress", (_str, key) => {
    // 卸载确认：w 确认 / n 取消 / Esc、Ctrl+C 退出 / 其他键只提醒一次
    if (pendingConfirm) {
      const decision = decideConfirm(key);
      if (decision === "exit") exit();
      else if (decision === "confirm") pendingConfirm.resolve(true);
      else if (decision === "cancel") pendingConfirm.resolve(false);
      else {
        pendingConfirm.reminded = true; // 提醒一次，等待下一个有效键
        paintFrame();
      }
      return;
    }
    if (busy) return;
    if (key.name === "up") {
      selected = (selected - 1 + TOOLS.length) % TOOLS.length;
      paintFrame();
    } else if (key.name === "down") {
      selected = (selected + 1) % TOOLS.length;
      paintFrame();
    } else if (key.name === "return") {
      doInstall(TOOLS[selected]);
    } else if (key.name === "v") {
      doVerify(TOOLS[selected]);
    } else if (key.name === "u") {
      doUninstall(TOOLS[selected]);
    } else if (key.name === "i") {
      doInfo(TOOLS[selected]);
    } else if (key.name === "r") {
      doRefresh();
    } else if (key.name === "q" || (key.ctrl && key.name === "c")) {
      exit();
    }
  });
}

/* ─────────────────────────── 入口 ─────────────────────────── */

async function main() {
  const args = process.argv.slice(2);
  const flag = args[0];

  if (!flag || flag.startsWith("-") === false) {
    await interactive();
    return;
  }

  switch (flag) {
    case "--list":
      return cliList(args);
    case "--refresh":
      return cliRefresh();
    case "--info":
      return cliInfo(args[1]);
    case "--install":
      return cliInstall(args[1]);
    case "--verify":
      return cliVerify(args[1]);
    case "--uninstall":
      return cliUninstall(args[1], args.slice(2));
    case "--help":
    case "-h":
      console.log(`AI CLI 安装平台
用法:
  node index.js                    交互式菜单
  node index.js --list             列出工具与安装状态
  node index.js --refresh          拉取全部工具最新版本
  node index.js --info <id>        查看单个工具详情
  node index.js --install <id>     非交互安装
  node index.js --verify <id>      验证安装
  node index.js --uninstall <id>   卸载（先自动备份数据到 backups/，加 --no-backup 跳过备份）
工具: ${TOOLS.map((t) => t.id).join(", ")}`);
      return;
    default:
      fail(`未知参数: ${flag}（--help 查看用法）`);
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(paint(C.red, `发生错误: ${e.message}`));
    process.exit(1);
  });
}

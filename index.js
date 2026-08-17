#!/usr/bin/env node
"use strict";

/**
 * ai-cli-hub — AI CLI 安装平台（终端菜单程序）
 *
 * 用法：
 *   node index.js                     交互式菜单（方向键选择、回车安装）
 *   node index.js --list              列出工具与安装状态
 *   node index.js --urls              列出所有工具的官方网址
 *   node index.js --refresh           拉取全部工具最新版本
 *   node index.js --info <id>         查看单个工具详情
 *   node index.js --install <id>      非交互安装
 *   node index.js --verify <id>       验证安装
 *   node index.js --uninstall <id>    卸载（先自动备份数据，--no-backup 跳过）
 *   node index.js --lang <zh|en>      切换中/英文
 *   node index.js --install-dir <dir> 自定义安装路径
 *   node index.js --api [...]         API Key 管理（list / add / remove）
 *   node index.js --compat <target> --provider <id>   兼容层：把 key 接入目标 CLI
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
const { t, setLang, getLang, detectLang } = require("./lib/i18n.js");
const { loadConfig, saveConfig, maskKey } = require("./lib/config.js");
const {
  PROVIDERS,
  PROVIDER_BY_ID,
  COMPAT_TARGETS,
  loadKeys,
  saveKeys,
  buildCompat,
  targetSupportsProvider,
} = require("./lib/api.js");
const { detectRegion } = require("./lib/region.js");
const { getNpmRegistry, getPipIndex, getNodeMirror, regionLabel } = require("./lib/sources.js");
const { checkEnv, installGit, installPython } = require("./lib/env.js");
const { runWizard, promptKeys } = require("./lib/wizard.js");

const TTY = process.stdout.isTTY;

/** 区域检测（进程内共享一次，带磁盘缓存） */
let regionPromise = null;
function ensureRegion() {
  if (!regionPromise) regionPromise = detectRegion();
  return regionPromise;
}

/** 平台自身版本号（来自 package.json） */
const PLATFORM_VERSION = (() => {
  try {
    return require("./package.json").version;
  } catch {
    return "0.0.0";
  }
})();

/** 小强 logo（原创 ASCII 吉祥物，见 assets/logo.txt） */
let LOGO = "";
try {
  LOGO = fs.readFileSync(path.join(__dirname, "assets", "logo.txt"), "utf8").replace(/\n$/, "");
} catch {
  LOGO = "🪳";
}

/* ─────────────────────────── CLI 模式 ─────────────────────────── */

async function cliList(args) {
  const useCache = args.includes("--offline");
  const region = await ensureRegion();
  // 已安装的工具不联网拉版本，只显示本地版本
  const installedIds = new Set(TOOLS.filter((t) => hasCommand(t.bin)).map((t) => t.id));
  const toFetch = TOOLS.filter((t) => !installedIds.has(t.id));
  const versions = useCache
    ? cachedAll(toFetch)
    : toFetch.length
      ? await refreshAll(toFetch, region)
      : {};
  const localVersions = {};
  await Promise.all(
    TOOLS.filter((t) => installedIds.has(t.id)).map(async (t) => {
      localVersions[t.id] = await binVersion(t.bin, t.verifyArgs);
    })
  );
  console.log(paint(C.cyan, LOGO));
  console.log(
    paint(C.bold + C.cyan, t("list_title", { version: PLATFORM_VERSION }) + "\n")
  );
  for (const tool of TOOLS) {
    const v = versions[tool.id];
    const isInstalled = installedIds.has(tool.id);
    const mark = isInstalled ? paint(C.green, t("list_installed")) : paint(C.dim, t("list_not_installed"));
    const latest = isInstalled
      ? paint(C.green, localVersions[tool.id] ? `${t("list_local")} ${localVersions[tool.id]}` : t("list_local"))
      : v
        ? `${v.version}${v.offline ? paint(C.yellow, t("list_cached")) : ""}`
        : paint(C.red, t("list_unknown"));
    console.log(
      `  ${pad(tool.id, 14)} ${mark}  ${pad(tool.name, 22)} ${t("list_latest")}${pad(latest, 18)} ${paint(
        C.dim,
        tool.vendor
      )}`
    );
  }
  console.log(`\n${paint(C.dim, t("list_footer"))}\n`);
}

async function cliRefresh() {
  console.log(paint(C.cyan, t("fetching_versions")));
  const region = await ensureRegion();
  const versions = await refreshAll(TOOLS, region);
  for (const tool of TOOLS) {
    const v = versions[tool.id];
    if (v) {
      console.log(
        `  ${pad(tool.id, 14)} ${pad(v.version, 12)} ${v.offline ? paint(C.yellow, t("refresh_cached")) : paint(C.green, t("refresh_updated"))}  ${v.source}`
      );
    } else {
      console.log(`  ${pad(tool.id, 14)} ${paint(C.red, t("refresh_failed"))}`);
    }
  }
}

/** 列出所有工具的官方网址（避免用户搜到假站/冒名站） */
async function cliUrls() {
  console.log(paint(C.bold + C.cyan, t("urls_title", { version: PLATFORM_VERSION }) + "\n"));
  for (const tool of TOOLS) {
    const src =
      tool.kind === "npm"
        ? `npm: ${tool.pkg}`
        : tool.kind === "pip"
          ? `pip: ${tool.pkg}`
          : `github: ${tool.repo}`;
    console.log(`  ${pad(tool.id, 14)} ${pad(tool.name, 22)}`);
    console.log(`                 ${paint(C.cyan, tool.homepage || t("urls_not_provided"))}`);
    console.log(`                 ${t("urls_source", { src })}${paint(C.dim, "")}\n`);
  }
}

async function cliInfo(id) {
  const tool = BY_ID.get(id);
  if (!tool) return fail(t("unknown_tool", { id, list: TOOLS.map((x) => x.id).join(", ") }));
  const versions = await refreshAll([tool]);
  const v = versions[id];
  const installed = hasCommand(tool.bin);
  console.log(`\n${paint(C.bold + C.cyan, tool.name)}  ${paint(C.dim, tool.vendor)} ${paint(C.magenta, `[${tool.tag}]`)}`);
  console.log(`  ${t("info_kind")}  ${tool.kind === "npm" ? `npm · ${tool.pkg}` : tool.kind === "pip" ? `pip · ${tool.pkg}` : `ps1-oneliner · ${tool.repo}`}`);
  console.log(`  ${t("info_cmd")}  ${tool.bin} ${(tool.verifyArgs || []).join(" ")}`);
  console.log(`  ${t("info_latest")}  ${v ? v.version + (v.offline ? t("list_cached") : "") : t("list_unknown")}`);
  console.log(
    `  ${t("info_status")}  ${installed ? paint(C.green, t("info_installed")) + (whereBin(tool.bin) ? ` @ ${whereBin(tool.bin)}` : "") : paint(C.dim, t("info_not_installed"))}`
  );
  if (tool.dataDirs && tool.dataDirs.length) {
    console.log(`  ${t("info_data_dirs")}  ${tool.dataDirs.map((d) => d.path).join(", ")}${t("info_backup_note")}`);
  }
  if (tool.homepage) console.log(`  ${t("info_homepage")}  ${tool.homepage}`);
  console.log(`  ${t("info_desc")}  ${tool.note}\n`);
}

async function cliInstall(id) {
  const tool = BY_ID.get(id);
  if (!tool) return fail(t("unknown_tool", { id, list: TOOLS.map((x) => x.id).join(", ") }));
  if (hasCommand(tool.bin)) {
    console.log(paint(C.yellow, t("install_skip", { bin: tool.bin })));
    return;
  }
  const cfg = loadConfig();
  const region = await ensureRegion();
  console.log(paint(C.cyan, t("install_start", { name: tool.name })));
  const res = installTool(tool, { stream: true, installDir: cfg.installDir, region });
  console.log(res.message);
  const v = await verifyTool(tool);
  console.log(v.message);
}

async function cliVerify(id) {
  const tool = BY_ID.get(id);
  if (!tool) return fail(t("unknown_tool", { id, list: TOOLS.map((x) => x.id).join(", ") }));
  const v = await verifyTool(tool);
  console.log(v.message);
}

/**
 * 卸载前备份数据；返回 true 可继续卸载，false 应中止。
 * 备份失败（如文件占用/权限）不会硬崩，而是中止卸载保护数据。
 */
function backupBeforeUninstall(tool, { quiet = false } = {}) {
  if (!tool.dataDirs || tool.dataDirs.length === 0) {
    if (!quiet) console.log(paint(C.dim, t("backup_no_data_dirs", { name: tool.name })));
    return true;
  }
  let result;
  try {
    result = backupTool(tool);
  } catch (e) {
    console.log(paint(C.red, t("backup_failed", { name: tool.name, msg: e.message })));
    console.log(paint(C.yellow, t("backup_abort")));
    return false;
  }
  if (result.saved.length === 0) {
    if (!quiet) {
      console.log(
        paint(C.dim, t("backup_none_found", { name: tool.name, dirs: result.missing.join(", ") }))
      );
    }
    return true;
  }
  console.log(paint(C.cyan, t("backup_done", { name: tool.name, dest: result.dest })));
  for (const s of result.saved) {
    console.log(`   ✓ ${s.path}${s.note ? `（${s.note}）` : ""}`);
  }
  console.log(paint(C.yellow, t("backup_credential_warn")));
  return true;
}

async function cliUninstall(id, args) {
  const tool = BY_ID.get(id);
  if (!tool) return fail(t("unknown_tool", { id, list: TOOLS.map((x) => x.id).join(", ") }));
  const noBackup = args.includes("--no-backup");
  if (!hasCommand(tool.bin)) {
    console.log(paint(C.yellow, t("uninstall_not_found", { bin: tool.bin })));
    return;
  }
  if (!noBackup) {
    if (!backupBeforeUninstall(tool)) return;
  }
  const res = uninstallTool(tool, { stream: true });
  console.log(res.message);
}

/* ─────────────── API Key 管理与兼容层 ─────────────── */

function cliApi(sub, arg1, arg2) {
  const keys = loadKeys();
  if (!sub || sub === "list") {
    console.log(paint(C.bold + C.cyan, t("api_title", { version: PLATFORM_VERSION }) + "\n"));
    const any = Object.keys(keys).length > 0;
    for (const p of PROVIDERS) {
      const has = keys[p.id]?.key;
      const status = has
        ? paint(C.green, t("api_configured", { masked: maskKey(has) }))
        : paint(C.dim, t("api_no_key"));
      console.log(
        `  ${pad(p.id, 12)} ${pad(p.name, 22)} ${status}`
      );
      console.log(`               ${paint(C.dim, p.consoleUrl)}`);
    }
    if (!any) console.log(`\n${paint(C.yellow, t("api_empty"))}`);
    console.log(`\n${paint(C.dim, t("api_usage"))}`);
    console.log(paint(C.dim, `${t("api_providers_hint", { list: PROVIDERS.map((p) => p.id).join(", ") })}`));
    return;
  }
  if (sub === "add") {
    if (!arg1 || !arg2) return fail(t("api_key_missing"));
    const p = PROVIDER_BY_ID.get(arg1);
    if (!p) return fail(t("api_not_found", { id: arg1 }));
    keys[arg1] = { key: arg2, addedAt: new Date().toISOString() };
    const saved = saveKeys(keys);
    console.log(paint(C.green, t("api_added", { provider: p.name, masked: maskKey(arg2) })));
    if (saved[arg1] && !saved[arg1].encrypted) {
      console.log(paint(C.yellow, t("api_encrypt_failed")));
    }
    return;
  }
  if (sub === "remove") {
    if (!arg1) return fail(t("api_not_found", { id: "" }));
    if (!keys[arg1]) return fail(t("api_not_found", { id: arg1 }));
    delete keys[arg1];
    saveKeys(keys);
    console.log(paint(C.green, t("api_removed", { provider: arg1 })));
    return;
  }
  fail(t("unknown_flag", { flag: `--api ${sub}` }));
}

function cliCompat(target, providerId) {
  const keys = loadKeys();
  if (!target || target === "list") {
    console.log(paint(C.bold + C.cyan, t("compat_title") + "\n"));
    console.log(`  ${t("compat_targets", { list: Object.keys(COMPAT_TARGETS).join(", ") })}\n`);
    console.log(`  ${paint(C.dim, t("compat_usage"))}`);
    console.log(`  ${paint(C.dim, t("api_providers_hint", { list: PROVIDERS.map((p) => p.id).join(", ") }))}`);
    return;
  }
  if (!providerId) return fail(t("compat_usage"));
  const provider = PROVIDER_BY_ID.get(providerId);
  if (!provider) return fail(t("api_not_found", { id: providerId }));
  if (!keys[providerId]?.key) {
    return fail(t("compat_provider_no_key", { provider: providerId }));
  }
  const support = targetSupportsProvider(target, provider);
  if (!support.ok) {
    if (support.reason === "protocol") {
      return fail(t("compat_protocol_unsupported", { target, provider: provider.name }));
    }
    if (support.reason === "only") {
      return fail(t("compat_only_providers", { target, allowed: (support.allowed || []).join(", ") }));
    }
    return fail(t("compat_unsupported_target", { target, list: Object.keys(COMPAT_TARGETS).join(", ") }));
  }
  const built = buildCompat(target, providerId);
  if (!built) return fail(t("compat_unsupported_target", { target, list: Object.keys(COMPAT_TARGETS).join(", ") }));

  if (built.kind === "cmd") {
    console.log(paint(C.green, t("wiz_compat_cmd")));
    console.log(`  ${paint(C.cyan, `  ${built.target.cmd}`)}`);
    if (built.target.note) console.log(`  ${paint(C.dim, built.target.note)}`);
    if (built.target.docs) console.log(`  ${t("info_homepage")} ${built.target.docs}`);
    return;
  }

  if (built.kind === "file") {
    try {
      if (fs.existsSync(built.file)) {
        fs.copyFileSync(built.file, `${built.file}.bak`);
        console.log(paint(C.yellow, t("wiz_backup_written", { file: `${built.file}.bak` })));
      }
      fs.mkdirSync(path.dirname(built.file), { recursive: true });
      fs.writeFileSync(built.file, JSON.stringify(built.content, null, 2));
    } catch (e) {
      return fail(t("error", { msg: e.message }));
    }
    console.log(paint(C.green, t("compat_generated", { target: built.target.name, provider: provider.name })));
    console.log(`  ${t("compat_written", { file: built.file })}`);
    if (built.target.docs) console.log(`  ${t("info_homepage")} ${built.target.docs}`);
    return;
  }

  try {
    fs.mkdirSync(path.dirname(built.file), { recursive: true });
    fs.writeFileSync(built.file, built.lines.join("\n") + "\n");
  } catch (e) {
    return fail(t("error", { msg: e.message }));
  }
  console.log(paint(C.green, t("compat_generated", { target: built.target.name, provider: provider.name })));
  console.log(`  ${t("compat_env_file", { file: built.file })}`);
  for (const line of built.lines) console.log(`    ${paint(C.cyan, line)}`);
  console.log(`  ${paint(C.dim, t("compat_written", { file: built.file }))}`);
  console.log(`  ${paint(C.dim, t("compat_apply_hint", { file: built.file, k: "KEY" }))}`);
  console.log(`  ${paint(C.dim, t("compat_note_env"))}`);
}

/* ─────────────── 环境与网络诊断 ─────────────── */

async function cliDoctor() {
  console.log(paint(C.bold + C.cyan, t("doctor_title", { version: PLATFORM_VERSION }) + "\n"));

  // 1. 环境检测
  console.log(paint(C.bold, t("doctor_env_header")));
  const env = checkEnv();
  const rows = [
    ["Node.js", env.node, "https://nodejs.org"],
    ["npm", env.npm, "https://www.npmjs.com"],
    ["git", env.git, "https://git-scm.com"],
    ["python", env.python, "https://www.python.org"],
    ["pip", env.pip, "https://pypi.org"],
  ];
  for (const [name, info, hint] of rows) {
    const status = info.ok ? paint(C.green, t("env_ok")) : paint(C.red, t("env_missing"));
    console.log(`  ${pad(name, 10)} ${status}${info.version ? paint(C.dim, `  ${info.version}`) : ""}`);
    // 缺什么自动装什么
    if (!info.ok && name === "git") {
      console.log(`  ${paint(C.yellow, t("env_install_start", { name: "git" }))}`);
      console.log(installGit() ? `  ${paint(C.green, t("env_install_ok", { name: "git" }))}` : `  ${paint(C.red, t("env_install_fail", { name: "git", hint }))}`);
    } else if (!info.ok && name === "python") {
      console.log(`  ${paint(C.yellow, t("env_install_start", { name: "python" }))}`);
      console.log(installPython() ? `  ${paint(C.green, t("env_install_ok", { name: "python" }))}` : `  ${paint(C.red, t("env_install_fail", { name: "python", hint }))}`);
    } else if (!info.ok) {
      console.log(`  ${paint(C.dim, `  ${hint}`)}`);
    }
  }

  // 2. 网络区域
  console.log(`\n${paint(C.cyan, t("env_detecting_region"))}`);
  const region = await ensureRegion();
  if (region) {
    console.log(paint(C.green, t("doctor_region", { region, label: regionLabel(region) })));
    console.log(
      paint(C.dim, t("doctor_sources", { npm: getNpmRegistry(region), pip: getPipIndex(region), node: getNodeMirror(region) }))
    );
  } else {
    console.log(paint(C.yellow, t("doctor_region_unknown")));
  }
  console.log(`\n${paint(C.dim, t("doctor_auto_hint"))}\n`);
}

async function cliRegion() {
  console.log(paint(C.cyan, t("env_detecting_region")));
  const region = await ensureRegion();
  if (region) {
    console.log(paint(C.green, t("doctor_region", { region, label: regionLabel(region) })));
    console.log(
      paint(C.dim, t("doctor_sources", { npm: getNpmRegistry(region), pip: getPipIndex(region), node: getNodeMirror(region) }))
    );
  } else {
    console.log(paint(C.yellow, t("doctor_region_unknown")));
  }
}

/* ─────────────── 配置命令 ─────────────── */

async function cliWizard() {
  if (!process.stdin.isTTY) {
    return fail(t("tty_warning"));
  }
  readline.emitKeypressEvents(process.stdin);
  const region = await ensureRegion();
  await runWizard({ region });
  process.exit(0);
}

function cliLang(langArg) {
  const l = langArg === "en" ? "en" : "zh";
  const cfg = loadConfig();
  cfg.lang = l;
  saveConfig(cfg);
  setLang(l);
  console.log(paint(C.green, t("config_lang_set", { lang: l })));
}

function cliInstallDir(dir) {
  if (!dir) return fail(t("config_install_dir_set", { dir: "(空)" }));
  const cfg = loadConfig();
  cfg.installDir = path.resolve(dir);
  saveConfig(cfg);
  console.log(paint(C.green, t("config_install_dir_set", { dir: cfg.installDir })));
  console.log(paint(C.yellow, t("config_install_dir_note")));
}

function cliConfig() {
  const cfg = loadConfig();
  const keys = loadKeys();
  console.log(
    t("config_show", {
      lang: cfg.lang || getLang(),
      dir: cfg.installDir || "（默认）",
      keys: Object.keys(keys).length,
    })
  );
}

/* ─────────────── 通用 ─────────────── */

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
  if (key.ctrl && (key.name === "c" || key.name === "q")) return "exit";
  const seq = key.sequence ?? "";
  if (seq === "\u001b") return "cancel"; // Esc
  if (seq === "w") return "confirm";
  if (seq === "n") return "cancel";
  return "remind";
}

module.exports = { decideConfirm };

/* ─────────────────────────── 交互模式 ─────────────────────────── */

/** 方向键选择列表（主菜单/通用） */
function pickMenu(items) {
  return new Promise((resolve) => {
    let sel = 0;
    const draw = () => {
      process.stdout.write("\x1b[2J\x1b[H");
      console.log(paint(C.cyan, LOGO));
      console.log(`\n${paint(C.bold + C.cyan, t("menu_title", { version: PLATFORM_VERSION }))}\n`);
      items.forEach((it, i) => {
        console.log(` ${i === sel ? paint(C.cyan + C.bold, "❯") : " "} ${it.label}`);
      });
      console.log(`\n${paint(C.dim, t("menu_footer"))}`);
    };
    const done = (value) => {
      try {
        process.stdin.setRawMode(false);
      } catch {}
      process.stdin.removeListener("keypress", handler);
      resolve(value);
    };
    const handler = (_str, key) => {
      if (key.name === "up") sel = (sel - 1 + items.length) % items.length;
      else if (key.name === "down") sel = (sel + 1) % items.length;
      else if (key.name === "return") return done(items[sel].value);
      else if (key.name === "q" || key.name === "escape" || (key.ctrl && (key.name === "c" || key.name === "q")))
        return done(null);
      draw();
    };
    process.stdin.on("keypress", handler);
    process.stdin.setRawMode(true); // 方向键必须 raw 模式才产生 keypress
    draw();
  });
}

/** 等待任意按键（raw 模式） */
function waitAnyKey() {
  return new Promise((resolve) => {
    const handler = (_s, key) => {
      process.stdin.removeListener("keypress", handler);
      resolve(key);
    };
    process.stdin.on("keypress", handler);
    process.stdin.setRawMode(true);
  });
}

/** 主菜单分发 */
async function interactive() {
  if (!process.stdin.isTTY) {
    console.error(paint(C.yellow, t("tty_warning")));
    process.exit(1);
  }
  readline.emitKeypressEvents(process.stdin);
  const region = await ensureRegion();
  for (;;) {
    const choice = await pickMenu([
      { label: `1. ${t("menu_option1")}`, value: "wizard" },
      { label: `2. ${t("menu_option2")}`, value: "tools" },
      { label: `3. ${t("menu_option3")}`, value: "overview" },
    ]);
    if (!choice) {
      process.stdout.write("\x1b[2J\x1b[H");
      console.log(paint(C.dim, t("bye")));
      process.exit(0);
    }
    if (choice === "wizard") {
      await runWizard({ region });
      continue;
    }
    if (choice === "tools") {
      await runToolListUI();
      continue;
    }
    if (choice === "overview") {
      try {
        await runSettingsMenu({ region });
      } catch (e) {
        process.stdout.write("\x1b[2J\x1b[H");
        console.log(paint(C.red, t("error", { msg: e.message })));
        console.log(paint(C.dim, t("press_any_key")));
        await waitAnyKey();
      }
      continue;
    }
  }
}

/** 已配置概览与设置（交互式：语言 / 安装路径 / API Key 均可调） */
async function runSettingsMenu({ region }) {
  const listKeys = () => loadKeys();
  for (;;) {
    const cfg = loadConfig();
    const keys = listKeys();
    const compatDir = path.join(
      process.env.AI_CLI_PLATFORM_HOME || path.join(os.homedir(), ".ai-cli-platform"),
      "compat"
    );
    let compatCount = 0;
    try {
      compatCount = fs.readdirSync(compatDir).filter((f) => f.endsWith(".env")).length;
    } catch {}
    process.stdout.write("\x1b[2J\x1b[H");
    console.log(paint(C.bold + C.cyan, `\n${t("settings_title")}\n`));
    console.log(`  ${t("settings_lang")} ${getLang() === "en" ? "English" : "中文"}`);
    console.log(`  ${t("settings_install_dir")} ${cfg.installDir || t("settings_default")}`);
    console.log(`  ${t("settings_keys")} ${Object.keys(keys).length}`);
    console.log(`  ${t("settings_compat")} ${compatCount}`);
    console.log("");
    const choice = await pickMenu([
      { label: `1. ${t("settings_opt_lang")}`, value: "lang" },
      { label: `2. ${t("settings_opt_dir")}`, value: "dir" },
      { label: `3. ${t("settings_opt_keys")}`, value: "keys" },
      { label: `4. ${t("settings_opt_back")}`, value: "back" },
    ]);
    if (!choice || choice === "back") return;

    if (choice === "lang") {
      const lang = await pickMenu([
        { label: "中文", value: "zh" },
        { label: "English", value: "en" },
      ]);
      if (lang) {
        cliLang(lang);
        await waitAnyKey();
      }
    } else if (choice === "dir") {
      const dir = await promptKeys(t("settings_enter_dir"), { mask: false });
      try {
        process.stdin.setRawMode(true);
      } catch {}
      const cfg2 = loadConfig();
      if (dir) cfg2.installDir = path.resolve(dir);
      else delete cfg2.installDir;
      saveConfig(cfg2);
      console.log(
        dir
          ? paint(C.green, t("config_install_dir_set", { dir: path.resolve(dir) }))
          : paint(C.green, t("settings_dir_reset"))
      );
      await waitAnyKey();
    } else if (choice === "keys") {
      await runKeysMenu();
    }
  }
}

/** API Key 管理子菜单 */
async function runKeysMenu() {
  for (;;) {
    const keys = loadKeys();
    process.stdout.write("\x1b[2J\x1b[H");
    console.log(paint(C.bold + C.cyan, `\n${t("keys_title")}\n`));
    for (const p of PROVIDERS) {
      const k = keys[p.id]?.key;
      console.log(
        `  ${pad(p.id, 12)} ${p.name}  ${k ? paint(C.green, t("api_configured", { masked: maskKey(k) })) : paint(C.dim, t("api_no_key"))}`
      );
    }
    console.log("");
    const choice = await pickMenu([
      { label: `1. ${t("keys_opt_add")}`, value: "add" },
      { label: `2. ${t("keys_opt_remove")}`, value: "remove" },
      { label: `3. ${t("keys_opt_back")}`, value: "back" },
    ]);
    if (!choice || choice === "back") return;
    if (choice === "add") {
      const provider = await pickMenu(
        PROVIDERS.map((p) => ({ label: `${p.name}  ${keys[p.id]?.key ? paint(C.green, "✓ " + maskKey(keys[p.id].key)) : paint(C.dim, "未配置")}`, value: p.id }))
      );
      if (!provider) continue;
      const key = await promptKeys(t("wiz_key_prompt", { provider: PROVIDER_BY_ID.get(provider).name }) + "\n", { mask: true });
      if (!key) continue;
      const all = loadKeys();
      all[provider] = { key, addedAt: new Date().toISOString() };
      const saved = saveKeys(all);
      console.log(paint(C.green, t("api_added", { provider: PROVIDER_BY_ID.get(provider).name, masked: maskKey(key) })));
      if (saved[provider] && !saved[provider].encrypted) console.log(paint(C.yellow, t("api_encrypt_failed")));
      await waitAnyKey();
    } else if (choice === "remove") {
      const configured = PROVIDERS.filter((p) => keys[p.id]?.key);
      if (!configured.length) {
        console.log(paint(C.yellow, t("api_empty")));
        await waitAnyKey();
        continue;
      }
      const provider = await pickMenu(configured.map((p) => ({ label: `${p.name} (${maskKey(keys[p.id].key)})`, value: p.id })));
      if (!provider) continue;
      const all = loadKeys();
      delete all[provider];
      saveKeys(all);
      console.log(paint(C.green, t("api_removed", { provider })));
      await waitAnyKey();
    }
  }
}

/** 工具列表界面（下载/拉取工具） */
async function runToolListUI() {
  await new Promise((resolve) => {
    (async () => {
  const HIDE_CURSOR = "\x1b[?25l";
  const SHOW_CURSOR = "\x1b[?25h";

  // 1. 已安装工具不联网拉版本；只拉未安装的
  process.stdout.write(paint(C.cyan, t("fetching_versions") + "\n"));
  const regionPromise = ensureRegion();
  const installedIds = new Set(TOOLS.filter((t) => hasCommand(t.bin)).map((t) => t.id));
  const toFetch = TOOLS.filter((t) => !installedIds.has(t.id));
  let versions = toFetch.length ? await refreshAll(toFetch, await regionPromise) : {};
  readline.cursorTo(process.stdout, 0);
  readline.clearLine(process.stdout, 0);
  if (toFetch.length && Object.values(versions).every((v) => v === null)) {
    versions = cachedAll(toFetch);
    if (Object.values(versions).every((v) => v === null)) {
      console.log(paint(C.yellow, t("offline_all")));
    } else {
      console.log(paint(C.yellow, t("offline_cache")));
    }
  }

  let selected = 0;
  let busy = false;
  let suppressKeys = false; // 等待任意键返回时抑制导航
  let pendingConfirm = null; // { tool, resolve }
  let statusCache = new Map();
  let frameRows = []; // 上一帧的行，用于增量重绘

  const refreshStatus = async () => {
    await Promise.all(
      TOOLS.map(async (tool) => {
        const installed = hasCommand(tool.bin);
        const version = installed ? await binVersion(tool.bin, tool.verifyArgs) : null;
        statusCache.set(tool.id, { installed, version });
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

  /** 整帧覆盖重绘：回顶 + 重写全部行（不整屏清空，避免闪屏/卡顿；滚动错位可自愈） */
  const paintFrame = () => {
    const rows = buildRows();
    // 每行补空格到固定宽度 + \x1b[K 清尾，最后 \x1b[J 清掉残留行
    process.stdout.write("\x1b[H" + rows.map((r) => r.padEnd(84) + "\x1b[K").join("\n") + "\x1b[J");
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
      console.log(paint(C.yellow, t("install_skip", { bin: tool.bin })));
      await new Promise((r) => setTimeout(r, 1200));
      fullRender();
      return;
    }
    const cfg = loadConfig();
    let installDir = cfg.installDir || "";
    // 未设置过安装位置时，安装前询问一次（回车=默认）
    if (!cfg.installDir) {
      const loc = await promptKeys(t("wiz_install_loc_prompt"), { mask: false });
      if (loc) {
        cfg.installDir = path.resolve(loc);
        saveConfig(cfg);
        installDir = cfg.installDir;
        console.log(paint(C.green, t("config_install_dir_set", { dir: installDir })));
        await new Promise((r) => setTimeout(r, 900));
      }
      try {
        process.stdin.setRawMode(true);
      } catch {}
    }
    const region = await ensureRegion();
    busy = true;
    fullRender();
    await runChild(() => {
      console.log(paint(C.cyan, "\n" + t("install_start", { name: tool.name })));
      const res = installTool(tool, { stream: true, installDir, region });
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
    suppressKeys = true;
    console.log(paint(C.dim, `\n${t("press_any_key")}`));
    await waitAnyKey();
    suppressKeys = false;
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
      console.log(paint(C.yellow, t("uninstall_manual", { name: tool.name })));
      await new Promise((r) => setTimeout(r, 1500));
      fullRender();
      return;
    }
    // 按键式确认（w/n 制）
    const answer = await new Promise((resolve) => {
      pendingConfirm = { tool, resolve };
      paintFrame();
    });
    pendingConfirm = null;
    if (!answer) {
      console.log(paint(C.yellow, t("uninstall_cancelled")));
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
      console.log(`  ${t("info_cmd")}  ${tool.bin}`);
      console.log(`  ${t("info_latest")}  ${v ? v.version + (v.offline ? t("list_cached") : "") : t("list_unknown")}`);
      if (tool.dataDirs && tool.dataDirs.length) {
        console.log(`  ${t("info_data_dirs")}  ${tool.dataDirs.map((d) => d.path).join(", ")}${t("info_backup_note")}`);
      }
      if (tool.homepage) console.log(`  ${t("info_homepage")}  ${tool.homepage}`);
      console.log(`  ${t("info_desc")}  ${tool.note}\n`);
    });
    busy = false;
    suppressKeys = true;
    console.log(paint(C.dim, `\n${t("press_any_key")}`));
    await waitAnyKey();
    suppressKeys = false;
    fullRender();
  };

  const doRefresh = async () => {
    busy = true;
    fullRender();
    await runChild(async () => {
      console.log(paint(C.cyan, "\n" + t("fetching_versions")));
      versions = await refreshAll(TOOLS);
      console.log(paint(C.green, t("refresh_done")));
    });
    busy = false;
    fullRender();
  };

  const exit = () => {
    try {
      process.stdin.setRawMode(false);
    } catch {}
    process.stdout.write("\x1b[2J\x1b[H" + SHOW_CURSOR);
    process.stdin.removeAllListeners("keypress");
    resolve(); // 返回主菜单
  };

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
    if (suppressKeys) return; // 查看信息/验证结果等待按键时，忽略导航键
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
    } else if (key.name === "q" || (key.ctrl && (key.name === "c" || key.name === "q"))) {
      exit();
    }
  });
    })().catch(() => resolve());
  });
}

/* ─────────────────────────── 入口 ─────────────────────────── */

async function main() {
  const args = process.argv.slice(2);

  // 语言：--lang 参数 > 环境变量 AI_CLI_LANG > 配置 > 系统区域（默认中文）
  const langIdx = args.indexOf("--lang");
  const langArg = langIdx >= 0 ? args[langIdx + 1] : null;
  const cfgLang = loadConfig().lang;
  const lang = langArg || process.env.AI_CLI_LANG || cfgLang || detectLang();
  setLang(lang);

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
    case "--urls":
      return cliUrls();
    case "--install":
      return cliInstall(args[1]);
    case "--verify":
      return cliVerify(args[1]);
    case "--uninstall":
      return cliUninstall(args[1], args.slice(2));
    case "--lang":
      return cliLang(args[1]);
    case "--install-dir":
      return cliInstallDir(args[1]);
    case "--config":
      return cliConfig();
    case "--doctor":
      return cliDoctor();
    case "--region":
      return cliRegion();
    case "--wizard":
      return cliWizard();
    case "--api":
      return cliApi(args[1], args[2], args[3]);
    case "--compat":
      return cliCompat(args[1], args[3]); // --compat <target> --provider <id>
    case "--version":
    case "-v":
      console.log(`ai-cli-hub v${PLATFORM_VERSION}`);
      return;
    case "--help":
    case "-h":
      console.log(`AI CLI 安装平台 v${PLATFORM_VERSION}
用法:
  node index.js                     交互式菜单
  node index.js --list              列出工具与安装状态
  node index.js --urls              列出所有工具的官方网址
  node index.js --refresh           拉取全部工具最新版本
  node index.js --info <id>         查看单个工具详情
  node index.js --install <id>      非交互安装
  node index.js --verify <id>       验证安装
  node index.js --uninstall <id>    卸载（先自动备份数据，加 --no-backup 跳过）
  node index.js --lang <zh|en>      切换语言（中/英）
  node index.js --install-dir <dir> 自定义安装路径
  node index.js --api               管理 API Key（list / add <id> <key> / remove <id>）
  node index.js --compat <target> --provider <id>   兼容层：把 key 接入目标 CLI
  node index.js --doctor            环境与网络诊断（缺什么自动装什么）
  node index.js --region            查看网络区域（国内/国外）与所用镜像源
工具: ${TOOLS.map((t) => t.id).join(", ")}`);
      return;
    default:
      fail(t("unknown_flag", { flag }));
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(paint(C.red, t("error", { msg: e.message })));
    process.exit(1);
  });
}

"use strict";

/**
 * 轻量 i18n：中文 / 英文 双语，全部界面文案走 t()。
 * 语言来源优先级：--lang 参数 > AI_CLI_LANG 环境变量 > 系统区域（zh 开头）> 默认中文
 */

let lang = "zh";

const zh = {
  // 通用
  tty_warning: "⚠️ 交互模式需要 TTY 终端。非交互场景请用 --list / --install <id> 等参数。",
  fetching_versions: "正在从官方源拉取版本信息...",
  offline_cache: "⚠️ 网络不可达，使用缓存版本信息。",
  offline_all: "⚠️ 完全离线，版本显示为「未知」。",
  busy: "⏳ 正在执行，请稍候...",
  bye: "再见 👋",
  error: "发生错误: {msg}",
  unknown_flag: "未知参数: {flag}（--help 查看用法）",
  unknown_tool: "未知工具: {id}（可用: {list}）",

  // 清单
  list_title: "AI CLI 安装平台 v{version} — 工具清单",
  list_installed: "✓ 已装",
  list_not_installed: "✗ 未装",
  list_latest: "最新:",
  list_cached: " (缓存)",
  list_unknown: "未知(离线)",
  list_footer: "交互模式: node index.js  |  离线快速列表: node index.js --list --offline",

  // 网址
  urls_title: "🪳 各工具官方网址（ai-cli-hub v{version}）",
  urls_source: "来源: {src}",
  urls_not_provided: "（未提供）",

  // 刷新
  refresh_updated: "✓ 已更新",
  refresh_cached: "(缓存)",
  refresh_failed: "拉取失败(离线)",
  refresh_done: "✅ 版本信息已更新",

  // 详情
  info_kind: "kind:",
  info_cmd: "命令:",
  info_latest: "最新版本:",
  info_status: "安装状态:",
  info_installed: "已安装",
  info_not_installed: "未安装",
  info_data_dirs: "数据目录:",
  info_backup_note: "（卸载前自动备份）",
  info_homepage: "官网:",
  info_desc: "说明:",

  // 安装
  install_start: "开始安装 {name} ...",
  install_skip: "⚠️ {bin} 已在 PATH 上，跳过安装。",
  install_npm_ok: "✅ npm install -g {pkg} 成功",
  install_npm_fail: "❌ npm install -g {pkg} 失败（exit {code}）",
  install_pip_ok: "✅ pip install {pkg} 成功",
  install_pip_fail: "❌ pip install {pkg} 失败（exit {code}）",
  install_ps1_ok: "✅ {name} 一行安装脚本执行完成",
  install_ps1_fail: "❌ {name} 安装脚本执行失败（exit {code}）",
  install_unsupported: "❌ 不支持的安装类型: {kind}",

  // 验证
  verify_ok: "✅ {bin} 可用",
  verify_version: "（版本: {ver}）",
  verify_path: "路径: {path}",
  verify_not_found: "❌ 未找到命令 {bin}（不在 PATH 上）",

  // 卸载
  uninstall_not_found: "⚠️ {bin} 未在 PATH 上，可能未安装或已是便携版，跳过卸载。",
  uninstall_cancelled: "✋ 已取消卸载（未执行任何卸载）。",
  uninstall_manual: "⚠️ {name} 不是 npm 安装的，请手动卸载（或删除便携目录）。",
  uninstall_ok: "✅ 已卸载 {pkg}",
  uninstall_fail: "❌ 卸载失败（exit {code}）",

  // 备份
  backup_no_data_dirs: "ℹ️ {name} 未登记用户数据目录，跳过备份。",
  backup_none_found: "ℹ️ 未发现 {name} 的用户数据（已检查: {dirs}），无需备份。",
  backup_done: "📦 已备份 {name} 的用户数据 → {dest}",
  backup_credential_warn: "   ⚠️ 备份包含配置/凭证，请妥善保管，用完可删除。",
  backup_failed: "❌ 备份 {name} 数据失败: {msg}",
  backup_abort: "   为保护你的数据，已中止卸载。可手动备份后重试（或 --no-backup 跳过）。",

  // 交互帧
  frame_title: "AI CLI 安装平台 — 从官方源一键安装终端编程工具",
  frame_footer: "↑/↓ 选择 · Enter 安装 · v 验证 · r 刷新版本 · u 卸载(先备份) · i 详情 · q 退出",
  frame_latest: "最新",
  frame_installed: " [已装{version}]",
  confirm_prompt: "确认卸载 {name}？请按 w 确认，n 取消（Esc / Ctrl+C 退出）",
  confirm_remind: "⚠️ 请按 w 或者 n（Esc / Ctrl+C 退出）",

  // API Key 管理
  api_title: "🪳 API Key 管理（ai-cli-hub v{version}）",
  api_provider: "提供商",
  api_status: "状态",
  api_no_key: "未配置",
  api_configured: "已配置 {masked}",
  api_usage: "用法: node index.js --api add <提供商> <Key>",
  api_providers_hint: "可用提供商: {list}",
  api_added: "✅ 已保存 {provider} 的 API Key（{masked}）",
  api_removed: "✅ 已删除 {provider} 的 API Key",
  api_not_found: "未找到提供商 {id}",
  api_key_missing: "❌ 缺少 API Key。用法: node index.js --api add <提供商> <Key>",
  api_empty: "ℹ️ 尚未保存任何 API Key。",

  // 兼容层
  compat_title: "🔌 兼容配置（API Key 接入目标 CLI）",
  compat_usage: "用法: node index.js --compat <目标> --provider <提供商>",
  compat_generated: "✅ 已生成 {target} 的兼容配置（使用 {provider}）",
  compat_env_file: "环境变量文件: {file}",
  compat_apply_hint: "PowerShell: Get-Content '{file}' | ForEach-Object {{ $env:{k} = $_ }}",
  compat_targets: "支持的目标: {list}",
  compat_provider_no_key: "❌ 提供商 {provider} 未配置 API Key。先运行: node index.js --api add {provider} <Key>",
  compat_unsupported_target: "❌ 不支持的目标: {target}（支持: {list}）",
  compat_protocol_unsupported: "❌ {provider} 不支持 {target} 所需的协议（该目标走 Anthropic 协议，此提供商未提供 /anthropic 兼容端点）",
  compat_written: "已写入: {file}",
  compat_note_env: "提示: 也可手动设置环境变量后运行目标 CLI。",

  // 配置
  config_lang_set: "✅ 语言已切换为: {lang}（中文/English）",
  config_install_dir_set: "✅ 安装路径已设置为: {dir}",
  config_install_dir_note: "npm/pip 工具将安装到该路径（需自行加入 PATH）",
  config_show: "当前配置:\n  语言: {lang}\n  安装路径: {dir}\n  API Key 数: {keys}",
};

const en = {
  tty_warning: "⚠️ Interactive mode needs a TTY. For scripts use --list / --install <id> etc.",
  fetching_versions: "Fetching versions from official sources...",
  offline_cache: "⚠️ Network unreachable, using cached versions.",
  offline_all: "⚠️ Fully offline, versions shown as unknown.",
  busy: "⏳ Working, please wait...",
  bye: "Bye 👋",
  error: "Error: {msg}",
  unknown_flag: "Unknown flag: {flag} (see --help)",
  unknown_tool: "Unknown tool: {id} (available: {list})",

  list_title: "AI CLI Install Platform v{version} — Tool list",
  list_installed: "✓ installed",
  list_not_installed: "✗ not installed",
  list_latest: "latest:",
  list_cached: " (cached)",
  list_unknown: "unknown(offline)",
  list_footer: "Interactive: node index.js  |  Offline quick list: node index.js --list --offline",

  urls_title: "🪳 Official URLs of all tools (ai-cli-hub v{version})",
  urls_source: "source: {src}",
  urls_not_provided: "(not provided)",

  refresh_updated: "✓ updated",
  refresh_cached: "(cached)",
  refresh_failed: "fetch failed (offline)",
  refresh_done: "✅ Versions updated",

  info_kind: "kind:",
  info_cmd: "command:",
  info_latest: "latest:",
  info_status: "status:",
  info_installed: "installed",
  info_not_installed: "not installed",
  info_data_dirs: "data dirs:",
  info_backup_note: " (auto-backed-up before uninstall)",
  info_homepage: "homepage:",
  info_desc: "about:",

  install_start: "Installing {name} ...",
  install_skip: "⚠️ {bin} already on PATH, skipped.",
  install_npm_ok: "✅ npm install -g {pkg} succeeded",
  install_npm_fail: "❌ npm install -g {pkg} failed (exit {code})",
  install_pip_ok: "✅ pip install {pkg} succeeded",
  install_pip_fail: "❌ pip install {pkg} failed (exit {code})",
  install_ps1_ok: "✅ {name} one-line installer finished",
  install_ps1_fail: "❌ {name} installer failed (exit {code})",
  install_unsupported: "❌ Unsupported install kind: {kind}",

  verify_ok: "✅ {bin} available",
  verify_version: " (version: {ver})",
  verify_path: "path: {path}",
  verify_not_found: "❌ Command not found: {bin} (not on PATH)",

  uninstall_not_found: "⚠️ {bin} not on PATH — maybe not installed or portable only, skipped.",
  uninstall_cancelled: "✋ Uninstall cancelled (nothing was removed).",
  uninstall_manual: "⚠️ {name} is not npm-installed — please uninstall manually (or delete the portable folder).",
  uninstall_ok: "✅ Uninstalled {pkg}",
  uninstall_fail: "❌ Uninstall failed (exit {code})",

  backup_no_data_dirs: "ℹ️ {name} has no registered data dirs, skipped backup.",
  backup_none_found: "ℹ️ No user data found for {name} (checked: {dirs}), nothing to back up.",
  backup_done: "📦 Backed up {name} user data → {dest}",
  backup_credential_warn: "   ⚠️ Backup contains configs/credentials — keep it safe, delete when done.",
  backup_failed: "❌ Backing up {name} data failed: {msg}",
  backup_abort: "   Uninstall aborted to protect your data. Back up manually and retry (or use --no-backup).",

  frame_title: "AI CLI Install Platform — one-click install from official sources",
  frame_footer: "↑/↓ select · Enter install · v verify · r refresh · u uninstall(backup first) · i info · q quit",
  frame_latest: "latest",
  frame_installed: " [installed {version}]",
  confirm_prompt: "Uninstall {name}? Press w to confirm, n to cancel (Esc / Ctrl+C to exit)",
  confirm_remind: "⚠️ Please press w or n (Esc / Ctrl+C to exit)",

  api_title: "🪳 API Key Manager (ai-cli-hub v{version})",
  api_provider: "Provider",
  api_status: "Status",
  api_no_key: "not configured",
  api_configured: "configured {masked}",
  api_usage: "Usage: node index.js --api add <provider> <key>",
  api_providers_hint: "Available providers: {list}",
  api_added: "✅ Saved API key for {provider} ({masked})",
  api_removed: "✅ Removed API key for {provider}",
  api_not_found: "Provider not found: {id}",
  api_key_missing: "❌ Missing API key. Usage: node index.js --api add <provider> <key>",
  api_empty: "ℹ️ No API keys stored yet.",

  compat_title: "🔌 Compat config (wire an API key into a target CLI)",
  compat_usage: "Usage: node index.js --compat <target> --provider <providerId>",
  compat_generated: "✅ Generated {target} compat config (using {provider})",
  compat_env_file: "env file: {file}",
  compat_apply_hint: "PowerShell: Get-Content '{file}' | ForEach-Object {{ $env:{k} = $_ }}",
  compat_targets: "Supported targets: {list}",
  compat_provider_no_key: "❌ No API key for {provider}. First run: node index.js --api add {provider} <key>",
  compat_unsupported_target: "❌ Unsupported target: {target} (supported: {list})",
  compat_protocol_unsupported: "❌ {provider} does not support the protocol {target} needs (this target uses the Anthropic protocol; the provider has no /anthropic-compatible endpoint)",
  compat_written: "Written: {file}",
  compat_note_env: "Tip: you can also set the env vars manually before running the target CLI.",

  config_lang_set: "✅ Language switched to: {lang} (中文/English)",
  config_install_dir_set: "✅ Install dir set to: {dir}",
  config_install_dir_note: "npm/pip tools will install there (add it to PATH yourself)",
  config_show: "Current config:\n  language: {lang}\n  install dir: {dir}\n  API keys: {keys}",
};

const dicts = { zh, en };

/** 切换语言（zh / en，其余一律回退 zh） */
function setLang(l) {
  lang = l === "en" ? "en" : "zh";
  return lang;
}

function getLang() {
  return lang;
}

/** 翻译 + {占位符} 插值 */
function t(key, params) {
  const s = (dicts[lang] && dicts[lang][key]) ?? dicts.zh[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** 从 --lang 参数 / 环境变量 / 系统区域 探测语言 */
function detectLang(flag) {
  if (flag === "zh" || flag === "en") return flag;
  const env = process.env.AI_CLI_LANG;
  if (env === "zh" || env === "en") return env;
  const locale = String(process.env.LANG || process.env.LC_ALL || "").toLowerCase();
  if (locale.startsWith("zh")) return "zh";
  return "zh"; // 默认中文（面向中文开发者）
}

module.exports = { t, setLang, getLang, detectLang };

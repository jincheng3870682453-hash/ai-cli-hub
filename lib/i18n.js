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
  list_local: "本地",
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
  api_encrypt_failed: "⚠️ 警告: 本机无法加密（非 Windows / 无 PowerShell），Key 以明文保存，请注意安全",
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
  compat_only_providers: "❌ {target} 官方主要支持 {allowed} 的 key；可换提供商或用 OpenRouter 聚合",
  compat_protocol_unsupported: "❌ {provider} 不支持 {target} 所需的协议（该目标走 Anthropic 协议，此提供商未提供 /anthropic 兼容端点）",
  compat_written: "已写入: {file}",
  compat_note_env: "提示: 也可手动设置环境变量后运行目标 CLI。",

  // 配置
  config_lang_set: "✅ 语言已切换为: {lang}（中文/English）",
  config_install_dir_set: "✅ 安装路径已设置为: {dir}",
  config_install_dir_note: "npm/pip 工具将安装到该路径（需自行加入 PATH）",
  config_show: "当前配置:\n  语言: {lang}\n  安装路径: {dir}\n  API Key 数: {keys}",

  // 环境与网络诊断
  doctor_title: "🔧 环境与网络诊断（ai-cli-hub v{version}）",
  doctor_env_header: "环境检测:",
  doctor_region: "网络区域: {region}（{label}）",
  doctor_region_unknown: "网络区域: 未知（多个检测接口均不可达，将使用官方源）",
  doctor_sources: "镜像源: npm={npm} / pip={pip} / node={node}",
  doctor_auto_hint: "缺失环境会自动安装（git/python 走 winget）；Node 缺失时启动器自动下载便携版",
  env_ok: "✓ 已安装",
  env_missing: "✗ 缺失",
  env_install_start: "→ 自动安装 {name}（winget）...",
  env_install_ok: "✅ {name} 安装完成（请新开终端生效）",
  env_install_fail: "❌ {name} 自动安装失败，请手动安装: {hint}",
  env_detecting_region: "正在检测网络区域（国内/国外）...",

  // 主菜单与引导向导
  menu_title: "AI CLI 安装平台 v{version} — 主菜单",
  menu_option1: "引导配置（API Key → 模型 → 工具，自动适配）",
  menu_option2: "下载 / 拉取工具（工具列表）",
  menu_option3: "已配置概览（API Key / 兼容配置）",
  menu_option4: "一键启动（选模型 → 选 Key → 选工具 → 启动）",
  menu_footer: "↑/↓ 选择 · Enter 确认 · q 退出",
  wiz_step1_title: "① 选择你的 API Key 提供商（哪家公司的 key？）",
  wiz_step3_title: "③ 选择模型（{provider}）",
  wiz_step4_title: "④ 选择要用的工具（模型 {model}）",
  wiz_key_prompt: "输入 {provider} 的 API Key（Ctrl+V 粘贴 · 回车确认 · Ctrl+C/Ctrl+Q 取消）: ",
  wiz_key_empty: "⚠️ Key 不能为空，已取消。",
  wiz_key_saved: "✅ Key 已加密保存（DPAPI，仅本机可解）: {masked}",
  wiz_key_use_existing: "ℹ️ 使用已保存的 Key: {masked}",
  wiz_custom_model: "✏️ 自定义模型名（输入）",
  wiz_custom_model_prompt: "输入模型名（如 deepseek-v4-pro）:",
  wiz_installing: "⏳ {name} 未安装，正在自动下载（区域源）...",
  wiz_already_installed: "✅ {name} 已安装，跳过下载。",
  wiz_result_title: "✅ 配置完成，汇总如下",
  wiz_result_provider: "API Key 提供商:",
  wiz_result_model: "模型:",
  wiz_result_tool: "工具:",
  wiz_warn_protocol: "该工具走 Anthropic 协议",
  wiz_warn_only: "官方主要支持特定 key",
  wiz_compat_unsupported: "⚠️ 该组合没有现成的自动配置，但别灰心：",
  wiz_hint_openrouter: "提示: 可改用 OpenRouter 聚合（openrouter.ai）一个 key 通吃所有协议",
  wiz_compat_manual: "手动配置方式见下方官方文档链接。",
  wiz_compat_generated: "✅ 已生成兼容配置（任意 key 无缝接入）",
  wiz_compat_cmd: "✅ 该工具自带配置界面，运行:",
  wiz_apply_cmd: "注入方式: PowerShell → Get-Content '{file}' | ForEach-Object {{ $env:KEY = $_ }}，然后启动目标工具",
  wiz_backup_written: "原配置已备份: {file}",
  wiz_done: "按任意键返回主菜单...",
  wiz_install_loc_prompt: "安装位置（回车 = 默认 npm 全局，或输入自定义路径）: ",
  press_any_key: "按任意键返回...",

  // 设置菜单
  settings_title: "🪳 已配置概览与设置",
  settings_lang: "语言:",
  settings_install_dir: "安装路径:",
  settings_keys: "API Key:",
  settings_compat: "兼容配置:",
  settings_default: "（默认）",
  settings_opt_lang: "切换语言（中文 / English）",
  settings_opt_dir: "修改安装路径",
  settings_opt_keys: "管理 API Key",
  settings_opt_back: "返回主菜单",
  settings_enter_dir: "输入新的安装路径（回车 = 恢复默认）: ",
  settings_dir_reset: "✅ 安装路径已恢复默认（npm 全局）",
  keys_title: "🔑 API Key 管理",
  keys_opt_add: "添加 / 更新 Key",
  keys_opt_remove: "删除 Key",
  keys_opt_back: "返回设置",

  // 一键启动
  launch_step1: "① 选择模型（按提供商分组）",
  launch_no_key: "❌ {provider} 未保存 API Key，请先到「已配置概览」添加",
  launch_key_using: "🔑 使用 {provider} 的 Key: {masked}",
  launch_step3: "③ 选择要启动的工具",
  launch_installing: "⏳ {tool} 未安装，先自动下载...",
  launch_starting: "🚀 正在启动 {tool}（模型 {model} · {provider}）",
  launch_quit_hint: "退出 {bin} 后自动返回主菜单（在工具里 Ctrl+C 退出）",
  launch_failed: "❌ 启动失败: {msg}（可手动运行 {bin}）",
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
  list_local: "local",
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
  api_encrypt_failed: "⚠️ Warning: cannot encrypt on this machine (non-Windows / no PowerShell) — key stored as plaintext, keep it safe",
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
  compat_only_providers: "❌ {target} officially mainly supports {allowed} keys; switch provider or use OpenRouter",
  compat_protocol_unsupported: "❌ {provider} does not support the protocol {target} needs (this target uses the Anthropic protocol; the provider has no /anthropic-compatible endpoint)",
  compat_written: "Written: {file}",
  compat_note_env: "Tip: you can also set the env vars manually before running the target CLI.",

  config_lang_set: "✅ Language switched to: {lang} (中文/English)",
  config_install_dir_set: "✅ Install dir set to: {dir}",
  config_install_dir_note: "npm/pip tools will install there (add it to PATH yourself)",
  config_show: "Current config:\n  language: {lang}\n  install dir: {dir}\n  API keys: {keys}",

  // 环境与网络诊断
  doctor_title: "🔧 Environment & network diagnostics (ai-cli-hub v{version})",
  doctor_env_header: "Environment check:",
  doctor_region: "Network region: {region} ({label})",
  doctor_region_unknown: "Network region: unknown (all geo endpoints unreachable, using official sources)",
  doctor_sources: "Mirrors: npm={npm} / pip={pip} / node={node}",
  doctor_auto_hint: "Missing tools are auto-installed (git/python via winget); a missing Node is auto-downloaded by the launcher",
  env_ok: "✓ installed",
  env_missing: "✗ missing",
  env_install_start: "→ Auto-installing {name} (winget)...",
  env_install_ok: "✅ {name} installed (open a new terminal to use it)",
  env_install_fail: "❌ Auto-install of {name} failed, install manually: {hint}",
  env_detecting_region: "Detecting network region (CN / intl)...",

  // 主菜单与引导向导
  menu_title: "AI CLI Install Platform v{version} — Main menu",
  menu_option1: "Guided setup (API key → model → tool, auto-adapt)",
  menu_option2: "Download / fetch tools (tool list)",
  menu_option3: "Configured overview (API keys / compat)",
  menu_option4: "One-click launch (model → key → tool → start)",
  menu_footer: "↑/↓ select · Enter confirm · q quit",
  wiz_step1_title: "① Choose your API key provider (whose key do you have?)",
  wiz_step3_title: "③ Choose a model ({provider})",
  wiz_step4_title: "④ Choose the tool to use (model {model})",
  wiz_key_prompt: "Enter the {provider} API key (Ctrl+V to paste · Enter to confirm · Ctrl+C/Ctrl+Q to cancel): ",
  wiz_key_empty: "⚠️ Key must not be empty, cancelled.",
  wiz_key_saved: "✅ Key saved encrypted (DPAPI, this machine only): {masked}",
  wiz_key_use_existing: "ℹ️ Using saved key: {masked}",
  wiz_custom_model: "✏️ Custom model name (type it)",
  wiz_custom_model_prompt: "Model name (e.g. deepseek-v4-pro):",
  wiz_installing: "⏳ {name} not installed, auto-downloading (regional source)...",
  wiz_already_installed: "✅ {name} already installed, skipped.",
  wiz_result_title: "✅ Setup complete — summary",
  wiz_result_provider: "API key provider:",
  wiz_result_model: "Model:",
  wiz_result_tool: "Tool:",
  wiz_warn_protocol: "this tool speaks the Anthropic protocol",
  wiz_warn_only: "officially mainly supports a specific key",
  wiz_compat_unsupported: "⚠️ No ready-made auto-config for this combo, but don't worry:",
  wiz_hint_openrouter: "Tip: use OpenRouter (openrouter.ai) — one key for all protocols",
  wiz_compat_manual: "Manual config steps are in the official docs link below.",
  wiz_compat_generated: "✅ Compat config generated (any key, seamless)",
  wiz_compat_cmd: "✅ This tool has its own config UI, run:",
  wiz_apply_cmd: "Apply: PowerShell → Get-Content '{file}' | ForEach-Object {{ $env:KEY = $_ }}, then start the tool",
  wiz_backup_written: "Original config backed up: {file}",
  wiz_done: "Press any key to return to the main menu...",
  wiz_install_loc_prompt: "Install location (Enter = default npm global, or type a custom path): ",
  press_any_key: "Press any key to return...",

  // 设置菜单
  settings_title: "🪳 Settings & overview",
  settings_lang: "Language:",
  settings_install_dir: "Install dir:",
  settings_keys: "API keys:",
  settings_compat: "Compat configs:",
  settings_default: "(default)",
  settings_opt_lang: "Switch language (中文 / English)",
  settings_opt_dir: "Change install dir",
  settings_opt_keys: "Manage API keys",
  settings_opt_back: "Back to main menu",
  settings_enter_dir: "New install dir (Enter = reset to default): ",
  settings_dir_reset: "✅ Install dir reset to default (npm global)",
  keys_title: "🔑 API Key Manager",
  keys_opt_add: "Add / update key",
  keys_opt_remove: "Remove key",
  keys_opt_back: "Back to settings",

  // 一键启动
  launch_step1: "① Choose a model (grouped by provider)",
  launch_no_key: "❌ No API key saved for {provider} — add one in Settings & overview first",
  launch_key_using: "🔑 Using {provider} key: {masked}",
  launch_step3: "③ Choose the tool to launch",
  launch_installing: "⏳ {tool} not installed, downloading first...",
  launch_starting: "🚀 Launching {tool} (model {model} · {provider})",
  launch_quit_hint: "You'll return to the main menu after exiting {bin} (Ctrl+C inside the tool)",
  launch_failed: "❌ Launch failed: {msg} (you can run {bin} manually)",
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

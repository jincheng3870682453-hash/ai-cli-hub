"use strict";

/**
 * 工具注册表 — 平台支持的所有终端编程工具。
 *
 * kind 类型：
 *   - "npm"          官方 npm 包，`npm install -g <pkg>` 安装
 *   - "pip"          官方 PyPI 包，`pip install <pkg>` 安装
 *   - "ps1-oneliner" 官方 PowerShell 一行安装脚本（irm ... | iex）
 *
 * dataDirs：该工具的用户数据目录（配置 / 会话 / 凭证）。
 *   卸载前会把这些目录备份到平台 backups/ 目录，再执行卸载。
 *   目录不存在会自动跳过；路径以 ~ 开头表示用户主目录。
 *
 * 真伪校验原则（这是平台的核心价值）：
 *   - npm 包必须是官方 scoped 包名（如 @moonshot-ai/kimi-code），
 *     拒绝裸名包（如 kimi-cli —— 冒名坑，见 README）
 *   - 每个工具的 pkg/repo 都经过人工核对官方文档确认
 */

const TOOLS = [
  {
    id: "deepseek-cli",
    name: "DeepSeek CLI",
    vendor: "jincheng3870682453-hash（自研 · 社区项目）",
    tag: "自研",
    kind: "ps1-oneliner",
    repo: "jincheng3870682453-hash/DeepSeek-CLI",
    branch: "master",
    onelinerUrl:
      "https://raw.githubusercontent.com/jincheng3870682453-hash/DeepSeek-CLI/master/install-oneliner.ps1",
    bin: "deepseek",
    verifyArgs: ["--version"],
    dataDirs: [
      { path: "~/.dsh", note: "DSH 配置 / 会话 / 凭证（安装脚本默认 DSH_HOME）" },
      { path: "~/.deepseek-cli", note: "CLI 层配置（若存在）" },
    ],
    note:
      "基于 DeepSeek Harness 引擎的终端 Agent：配置向导 / 权限模式 / 流式对话。安装脚本自动装 Node（如缺失）+ 官方 dsh 引擎（内置，无需单独装）+ CLI 层。首次运行引导配置 DeepSeek API Key。",
    homepage: "https://github.com/jincheng3870682453-hash/DeepSeek-CLI",
  },
  {
    id: "kimi-code",
    name: "Kimi Code",
    vendor: "Moonshot AI（官方）",
    tag: "官方",
    kind: "npm",
    pkg: "@moonshot-ai/kimi-code",
    bin: "kimi",
    verifyArgs: ["--version"],
    dataDirs: [{ path: "~/.kimi-code", note: "配置 / 会话 / 凭证（KIMI_CODE_HOME）" }],
    note: "Kimi 官方终端编程助手。运行后 /login 登录账号或 /provider 配 API Key。",
    homepage: "https://www.kimi.com/code",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    vendor: "Anthropic（官方）",
    tag: "官方",
    kind: "npm",
    pkg: "@anthropic-ai/claude-code",
    bin: "claude",
    verifyArgs: ["--version"],
    dataDirs: [
      { path: "~/.claude", note: "配置 / 会话 / 凭证 / 历史" },
      { path: "~/.claude.json", note: "全局设置" },
    ],
    note: "Anthropic 官方终端编程助手。",
    homepage: "https://claude.com/claude-code",
  },
  {
    id: "codex",
    name: "Codex",
    vendor: "OpenAI（官方）",
    tag: "官方",
    kind: "npm",
    pkg: "@openai/codex",
    bin: "codex",
    verifyArgs: ["--version"],
    dataDirs: [{ path: "~/.codex", note: "配置 / 会话 / 凭证" }],
    note: "OpenAI 官方终端编码代理。",
    homepage: "https://github.com/openai/codex",
  },
  {
    id: "opencode",
    name: "OpenCode",
    vendor: "OpenCode（开源 · 智谱官方推荐可接入 GLM）",
    tag: "开源",
    kind: "npm",
    pkg: "opencode-ai",
    bin: "opencode",
    verifyArgs: ["--version"],
    dataDirs: [
      { path: "~/.config/opencode", note: "配置（config.json / auth.json）" },
      { path: "~/.local/share/opencode", note: "会话 / 消息数据" },
    ],
    note: "开源终端编码代理。智谱官方文档推荐：opencode auth login 选择 Zhipu AI Coding Plan。",
    homepage: "https://opencode.ai",
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    vendor: "Google（官方）",
    tag: "官方",
    kind: "npm",
    pkg: "@google/gemini-cli",
    bin: "gemini",
    verifyArgs: ["--version"],
    dataDirs: [{ path: "~/.gemini", note: "配置 / 会话 / 凭证" }],
    note: "Google 官方终端 AI 助手。",
    homepage: "https://github.com/google-gemini/gemini-cli",
  },
  {
    id: "qwen-code",
    name: "Qwen Code",
    vendor: "Alibaba（官方）",
    tag: "官方",
    kind: "npm",
    pkg: "@qwen-code/qwen-code",
    bin: "qwen",
    verifyArgs: ["--version"],
    dataDirs: [{ path: "~/.qwen", note: "配置 / 会话（若存在）" }],
    note: "阿里通义官方终端编程助手（Qwen3 系列）。注意：裸名包 qwen-code 是冒名的，勿用。",
    homepage: "https://github.com/QwenLM/qwen-code",
  },
  {
    id: "deep-code",
    name: "Deep Code",
    vendor: "lessweb（DeepSeek 官方收录）",
    tag: "官方收录",
    kind: "npm",
    pkg: "@vegamo/deepcode-cli",
    bin: "deepcode",
    verifyArgs: ["--version"],
    dataDirs: [{ path: "~/.deepcode", note: "settings.json（含 API Key）" }],
    note:
      "专为 deepseek-v4 优化的终端编码助手（DeepSeek 官方 API 文档收录）。装完需建 ~/.deepcode/settings.json 填 API Key。",
    homepage: "https://api-docs.deepseek.com/quick_start/agent_integrations/deepcode/",
  },
  {
    id: "amp",
    name: "Amp",
    vendor: "Sourcegraph（官方）",
    tag: "官方",
    kind: "npm",
    pkg: "@ampcode/cli",
    bin: "amp",
    verifyArgs: ["--version"],
    dataDirs: [{ path: "~/.amp", note: "配置 / 会话（若存在）" }],
    note: "Sourcegraph 的终端编码代理（原 @sourcegraph/amp，已改名 @ampcode/cli）。",
    homepage: "https://ampcode.com",
  },
  {
    id: "aider",
    name: "Aider",
    vendor: "Aider（开源）",
    tag: "开源",
    kind: "pip",
    pkg: "aider-chat",
    bin: "aider",
    verifyArgs: ["--version"],
    dataDirs: [{ path: "~/.aider.conf.yml", note: "配置文件（若存在）" }],
    note: "经典的开源终端结对编程工具，AI pair programming in your terminal。需要本机有 Python/pip。",
    homepage: "https://aider.chat",
  },
  {
    id: "continue",
    name: "Continue CLI",
    vendor: "Continue（官方）",
    tag: "官方",
    kind: "npm",
    pkg: "@continuedev/cli",
    bin: "cn",
    verifyArgs: ["--version"],
    dataDirs: [{ path: "~/.continue", note: "配置 / 会话（若存在）" }],
    note: "Continue 官方终端 CLI。注意：命令名是 cn（不是 continue）；裸名包 continue 是冒名的。",
    homepage: "https://github.com/continuedev/continue",
  },
  {
    id: "aiconn",
    name: "AIConn",
    vendor: "aiconn（开源）",
    tag: "开源",
    kind: "npm",
    pkg: "aiconn",
    bin: "aiconn",
    verifyArgs: ["--version"],
    dataDirs: [{ path: "~/.aiconn", note: "配置 / 密钥（若存在）" }],
    note: "统一管理各家 LLM API 请求的终端工具。",
    homepage: "https://www.npmjs.com/package/aiconn",
  },
  {
    id: "zhipu-helper",
    name: "智谱 GLM Coding Plan 助手",
    vendor: "Zhipu AI（官方）",
    tag: "官方",
    kind: "npm",
    pkg: "@z_ai/coding-helper",
    bin: "coding-helper",
    verifyArgs: ["--help"],
    dataDirs: [],
    note: "智谱官方一键配置助手：把 GLM Coding Plan 配置进 Claude Code / OpenCode / Cursor 等工具。",
    homepage: "https://docs.bigmodel.cn/cn/coding-plan/extension/coding-tool-helper",
  },
];

/**
 * 说明：官方 DeepSeek Harness (dsh) 引擎不再单列——
 *   1) DeepSeek-CLI 安装脚本已自动内置 dsh（npm install -g @deepseek-ai/dsh），
 *      单独安装纯属冗余；
 *   2) 官方 Harness 本身是 Web 网页版（浏览器 GUI），不是终端工具，
 *      放进「终端安装平台」会误导。
 */

/** 工具 id → 工具定义 */
const BY_ID = new Map(TOOLS.map((t) => [t.id, t]));

module.exports = { TOOLS, BY_ID };

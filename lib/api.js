"use strict";

/**
 * API Key 管理 + 兼容层：
 *   1) 提供商目录（调研整理的市面主流模型 API Key 平台）
 *   2) key 的存储 / 增删查（config.js 落盘）
 *   3) 兼容层：把任意 OpenAI/Anthropic 兼容的 key 接入目标 CLI
 *      —— 例如 DeepSeek 的 key 可以直接接 Codex / OpenCode / Aider 等
 *
 * 注意：模型名可能随厂商更新，这里只做参考提示，以各平台控制台为准。
 */

const path = require("node:path");
const os = require("node:os");
const { loadKeys, saveKeys, maskKey } = require("./config.js");

/** 市面主流 API Key 提供商（调研整理，2026-08；模型名以各平台控制台为准） */
const PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek（深度求索）",
    consoleUrl: "https://platform.deepseek.com",
    baseUrl: "https://api.deepseek.com",
    anthropicCompat: "https://api.deepseek.com/anthropic",
    protocol: "openai",
    models: [
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "deepseek-chat",
      "deepseek-reasoner",
      "deepseek-r1",
      "deepseek-v3.2",
    ],
  },
  {
    id: "moonshot",
    name: "Kimi / Moonshot AI",
    consoleUrl: "https://platform.moonshot.cn",
    baseUrl: "https://api.moonshot.cn/v1",
    anthropicCompat: "https://api.moonshot.cn/anthropic",
    protocol: "openai",
    models: [
      "kimi-k2.7",
      "kimi-k2.7-code",
      "kimi-k2.6",
      "kimi-k2",
      "kimi-latest",
      "moonshot-v1-8k",
      "moonshot-v1-32k",
      "moonshot-v1-128k",
    ],
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    consoleUrl: "https://open.bigmodel.cn",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    anthropicCompat: "https://open.bigmodel.cn/api/anthropic",
    protocol: "openai",
    models: [
      "glm-5.2",
      "glm-5.1",
      "glm-5",
      "glm-4.7",
      "glm-4.6",
      "glm-4.5",
      "glm-4.5-air",
      "glm-4.5-flash",
      "glm-4.5v",
      "glm-4v-flash",
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    consoleUrl: "https://platform.openai.com",
    baseUrl: "https://api.openai.com/v1",
    protocol: "openai",
    models: ["gpt-5.5", "gpt-5.2", "gpt-4o", "gpt-4.1", "o3", "o4-mini"],
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    consoleUrl: "https://console.anthropic.com",
    baseUrl: "https://api.anthropic.com",
    protocol: "anthropic",
    models: [
      "claude-opus-4.7",
      "claude-opus-4.6",
      "claude-sonnet-4.5",
      "claude-3.7-sonnet",
      "claude-3.5-haiku",
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    consoleUrl: "https://aistudio.google.com",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    protocol: "gemini",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
  },
  {
    id: "qwen",
    name: "阿里通义 Qwen",
    consoleUrl: "https://bailian.console.aliyun.com",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    protocol: "openai",
    models: ["qwen3-max", "qwen3-coder", "qwen3.6", "qwen3-vl-plus", "qwen2.5-coder"],
  },
  {
    id: "siliconflow",
    name: "硅基流动 SiliconFlow",
    consoleUrl: "https://cloud.siliconflow.cn",
    baseUrl: "https://api.siliconflow.cn/v1",
    protocol: "openai",
    models: [
      "deepseek-ai/DeepSeek-V3",
      "deepseek-ai/DeepSeek-V3.1",
      "Qwen/Qwen3-235B-A22B",
      "Qwen/Qwen3-Coder-480B-A35B",
      "zai-org/GLM-5.2",
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter（聚合）",
    consoleUrl: "https://openrouter.ai",
    baseUrl: "https://openrouter.ai/api/v1",
    protocol: "openai",
    models: [
      "deepseek/deepseek-chat",
      "deepseek/deepseek-r1",
      "openai/gpt-5.5",
      "anthropic/claude-opus-4.7",
      "google/gemini-2.5-pro",
      "z-ai/glm-5.2",
    ],
  },
];

const PROVIDER_BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));

/**
 * 兼容目标：目标 CLI 需要的配置方式。
 *   kind: "env"   生成环境变量文件（.env）
 *   kind: "cmd"   提示用目标自带的配置命令
 *   kind: "file"  直接写目标配置文件（{file} 支持 ~ 展开；{template} 为模板）
 *   onlyProviders: 仅这些提供商适用（其他提供商接入时给警告但仍可生成）
 */
const COMPAT_TARGETS = {
  codex: {
    name: "Codex",
    kind: "env",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_BASE_URL", "{baseUrl}"],
    ],
    docs: "https://github.com/openai/codex",
  },
  opencode: {
    name: "OpenCode",
    kind: "env",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_BASE_URL", "{baseUrl}"],
    ],
    docs: "https://opencode.ai",
  },
  aider: {
    name: "Aider",
    kind: "env",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_API_BASE", "{baseUrl}"],
    ],
    docs: "https://aider.chat",
  },
  "claude-code": {
    name: "Claude Code",
    kind: "env",
    env: [
      ["ANTHROPIC_AUTH_TOKEN", "{key}"],
      ["ANTHROPIC_BASE_URL", "{baseUrlAnthropic}"],
    ],
    docs: "https://claude.com/claude-code",
  },
  continue: {
    name: "Continue CLI",
    kind: "env",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_BASE_URL", "{baseUrl}"],
    ],
    docs: "https://github.com/continuedev/continue",
  },
  "qwen-code": {
    name: "Qwen Code",
    kind: "env",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_BASE_URL", "{baseUrl}"],
    ],
    docs: "https://github.com/QwenLM/qwen-code",
  },
  amp: {
    name: "Amp",
    kind: "env",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_BASE_URL", "{baseUrl}"],
    ],
    docs: "https://ampcode.com",
  },
  "kimi-code": {
    name: "Kimi Code",
    kind: "cmd",
    cmd: "kimi /provider",
    note: "Kimi Code 自带 /provider 交互配置，选「Known third-party provider」即可",
    docs: "https://www.kimi.com/code",
  },
  "gemini-cli": {
    name: "Gemini CLI",
    kind: "env",
    env: [["GEMINI_API_KEY", "{key}"]],
    onlyProviders: ["gemini"],
    note: "Gemini CLI 官方主要支持 Google 自家 key",
    docs: "https://github.com/google-gemini/gemini-cli",
  },
  "deep-code": {
    name: "Deep Code",
    kind: "file",
    file: "~/.deepcode/settings.json",
    template: {
      env: { MODEL: "{model}", BASE_URL: "{baseUrl}", API_KEY: "{key}" },
      thinkingEnabled: true,
      reasoningEffort: "max",
    },
    docs: "https://api-docs.deepseek.com/quick_start/agent_integrations/deepcode/",
  },
  "deepseek-cli": {
    name: "DeepSeek CLI",
    kind: "env",
    env: [
      ["DEEPSEEK_API_KEY", "{key}"],
      ["DEEPSEEK_BASE_URL", "{baseUrl}"],
    ],
    onlyProviders: ["deepseek"],
    note: "DeepSeek CLI 基于 dsh 引擎，也支持引擎内多提供商配置",
    docs: "https://github.com/jincheng3870682453-hash/DeepSeek-CLI",
  },
  aiconn: {
    name: "AIConn",
    kind: "cmd",
    cmd: "aiconn",
    note: "AIConn 自带多 LLM 配置界面，把 key 加进去即可",
    docs: "https://www.npmjs.com/package/aiconn",
  },
  "zhipu-helper": {
    name: "智谱 GLM 助手",
    kind: "cmd",
    cmd: "chelper",
    note: "智谱官方一键配置助手（面向 GLM Coding Plan）",
    docs: "https://docs.bigmodel.cn/cn/coding-plan/extension/coding-tool-helper",
  },
};

/**
 * 校验目标是否支持某提供商：
 *   - Anthropic 目标要求提供商有 anthropicCompat 或本身就是 anthropic → 否则 reason "protocol"
 *   - 目标声明 onlyProviders 且不包含该提供商 → reason "only"
 *   - 其余视为兼容（"任何公司的 key 都能接任何工具"的兜底：能生成，只是可能需额外设置）
 */
function targetSupportsProvider(targetId, provider) {
  const t = COMPAT_TARGETS[targetId];
  if (!t) return { ok: false, reason: "target" };
  if (t.onlyProviders && !t.onlyProviders.includes(provider.id)) {
    return { ok: false, reason: "only", allowed: t.onlyProviders };
  }
  if (t.env) {
    const needsAnthropic = t.env.some(([k]) => k === "ANTHROPIC_BASE_URL");
    if (needsAnthropic) {
      if (provider.protocol === "anthropic" || provider.anthropicCompat) {
        return { ok: true };
      }
      return { ok: false, reason: "protocol" };
    }
  }
  return { ok: true };
}

/**
 * 生成目标 CLI 的兼容配置。
 * 返回 { file, lines, target, provider, kind } 或 null。
 * kind: "env" → 环境变量文件；"file" → 直接写配置文件；"cmd" → 无需生成。
 */
function buildCompat(targetId, providerId, model) {
  const target = COMPAT_TARGETS[targetId];
  const provider = PROVIDER_BY_ID.get(providerId);
  const keys = loadKeys();
  const key = keys[providerId]?.key;
  if (!target || !provider || !key) return null;

  const values = {
    key,
    baseUrl: provider.baseUrl,
    baseUrlAnthropic: provider.anthropicCompat || provider.baseUrl,
    model: model || (provider.models && provider.models[0]) || "",
  };

  const dir = path.join(
    process.env.AI_CLI_PLATFORM_HOME || path.join(os.homedir(), ".ai-cli-platform"),
    "compat"
  );

  if (target.kind === "file") {
    const file = target.file.startsWith("~")
      ? path.join(os.homedir(), target.file.slice(2))
      : path.resolve(target.file);
    const deepCopy = (obj) =>
      JSON.parse(JSON.stringify(obj).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? ""));
    return { file, target, provider, kind: "file", content: deepCopy(target.template) };
  }

  if (target.kind === "cmd") {
    return { file: null, target, provider, kind: "cmd" };
  }

  const lines = target.env.map(([k, tmpl]) =>
    `${k}=${tmpl.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "")}`
  );
  const file = path.join(dir, `${targetId}-${providerId}.env`);
  return { file, lines, target, provider, kind: "env" };
}

/** 旧版导出名（兼容 index.js 现有调用） */
function buildCompatEnv(targetId, providerId) {
  const r = buildCompat(targetId, providerId);
  if (!r || r.kind === "cmd") return null;
  return { file: r.file, lines: r.lines, target: r.target, provider: r.provider };
}

module.exports = {
  PROVIDERS,
  PROVIDER_BY_ID,
  COMPAT_TARGETS,
  loadKeys,
  saveKeys,
  maskKey,
  targetSupportsProvider,
  buildCompat,
  buildCompatEnv,
};

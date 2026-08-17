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

/** 市面主流 API Key 提供商（调研整理，2026-08） */
const PROVIDERS = [
  {
    id: "deepseek",
    name: "DeepSeek（深度求索）",
    consoleUrl: "https://platform.deepseek.com",
    baseUrl: "https://api.deepseek.com",
    anthropicCompat: "https://api.deepseek.com/anthropic",
    protocol: "openai",
    models: ["deepseek-chat", "deepseek-reasoner", "deepseek-v4-pro"],
  },
  {
    id: "moonshot",
    name: "Kimi / Moonshot AI",
    consoleUrl: "https://platform.moonshot.cn",
    baseUrl: "https://api.moonshot.cn/v1",
    anthropicCompat: "https://api.moonshot.cn/anthropic",
    protocol: "openai",
    models: ["kimi-k2", "moonshot-v1-8k", "kimi-latest"],
  },
  {
    id: "zhipu",
    name: "智谱 GLM",
    consoleUrl: "https://open.bigmodel.cn",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    anthropicCompat: "https://open.bigmodel.cn/api/anthropic",
    protocol: "openai",
    models: ["glm-5.2", "glm-4.7", "glm-4.5", "glm-4.5-air"],
  },
  {
    id: "openai",
    name: "OpenAI",
    consoleUrl: "https://platform.openai.com",
    baseUrl: "https://api.openai.com/v1",
    protocol: "openai",
    models: ["gpt-5.5", "gpt-4o", "o3"],
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    consoleUrl: "https://console.anthropic.com",
    baseUrl: "https://api.anthropic.com",
    protocol: "anthropic",
    models: ["claude-opus-4-7", "claude-sonnet-4-5"],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    consoleUrl: "https://aistudio.google.com",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    protocol: "gemini",
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
  },
  {
    id: "qwen",
    name: "阿里通义 Qwen",
    consoleUrl: "https://bailian.console.aliyun.com",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    protocol: "openai",
    models: ["qwen3-max", "qwen3-coder"],
  },
  {
    id: "siliconflow",
    name: "硅基流动 SiliconFlow",
    consoleUrl: "https://cloud.siliconflow.cn",
    baseUrl: "https://api.siliconflow.cn/v1",
    protocol: "openai",
    models: ["deepseek-ai/DeepSeek-V3", "Qwen/Qwen3-235B"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    consoleUrl: "https://openrouter.ai",
    baseUrl: "https://openrouter.ai/api/v1",
    protocol: "openai",
    models: ["deepseek/deepseek-chat", "openai/gpt-5.5"],
  },
];

const PROVIDER_BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]));

/** 兼容目标：目标 CLI 需要哪些环境变量 / 配置文件 */
const COMPAT_TARGETS = {
  codex: {
    name: "Codex",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_BASE_URL", "{baseUrl}"],
    ],
    note: "OpenAI 兼容协议；设好环境变量后运行 codex",
  },
  opencode: {
    name: "OpenCode",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_BASE_URL", "{baseUrl}"],
    ],
    note: "OpenAI 兼容协议；或 opencode auth login 选自定义提供商",
  },
  aider: {
    name: "Aider",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_API_BASE", "{baseUrl}"],
    ],
    note: "OpenAI 兼容协议；Aider 也支持 --openai-api-base",
  },
  "claude-code": {
    name: "Claude Code",
    env: [
      ["ANTHROPIC_AUTH_TOKEN", "{key}"],
      ["ANTHROPIC_BASE_URL", "{baseUrlAnthropic}"],
    ],
    note: "Anthropic 兼容协议；需要该提供商提供 /anthropic 端点",
  },
  continue: {
    name: "Continue CLI",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_BASE_URL", "{baseUrl}"],
    ],
    note: "OpenAI 兼容协议",
  },
  "qwen-code": {
    name: "Qwen Code",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_BASE_URL", "{baseUrl}"],
    ],
    note: "OpenAI 兼容协议",
  },
};

/** 校验目标是否支持某提供商（Anthropic 目标要求提供商有 anthropicCompat 或本身就是 anthropic） */
function targetSupportsProvider(targetId, provider) {
  const t = COMPAT_TARGETS[targetId];
  if (!t) return { ok: false, reason: "target" };
  const needsAnthropic = t.env.some(([k]) => k === "ANTHROPIC_BASE_URL");
  if (needsAnthropic) {
    if (provider.protocol === "anthropic" || provider.anthropicCompat) {
      return { ok: true };
    }
    return { ok: false, reason: "protocol" };
  }
  return { ok: true };
}

/** 生成目标 CLI 的兼容配置（环境变量文件） */
function buildCompatEnv(targetId, providerId) {
  const target = COMPAT_TARGETS[targetId];
  const provider = PROVIDER_BY_ID.get(providerId);
  const keys = loadKeys();
  const key = keys[providerId]?.key;
  if (!target || !provider || !key) return null;

  const values = {
    key,
    baseUrl: provider.baseUrl,
    baseUrlAnthropic: provider.anthropicCompat || provider.baseUrl,
  };
  const lines = target.env.map(([k, tmpl]) => `${k}=${tmpl.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "")}`);

  const dir = path.join(
    process.env.AI_CLI_PLATFORM_HOME || path.join(os.homedir(), ".ai-cli-platform"),
    "compat"
  );
  const file = path.join(dir, `${targetId}-${providerId}.env`);
  return { file, lines, target, provider };
}

module.exports = {
  PROVIDERS,
  PROVIDER_BY_ID,
  COMPAT_TARGETS,
  loadKeys,
  saveKeys,
  maskKey,
  targetSupportsProvider,
  buildCompatEnv,
};

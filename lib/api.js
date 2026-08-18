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
    // Codex 只认 Responses 协议；DeepSeek V4 原生提供 /responses 端点，可直接接入
    codexCompat: "responses",
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
    // Kimi / Moonshot 主走 Chat Completions，未提供 /responses 端点，Codex 需经网关协议转换接入
    codexCompat: "gateway",
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
    // 智谱 GLM 只提供 Chat Completions，无 /responses 端点，Codex 需经网关协议转换接入
    codexCompat: "gateway",
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
    // OpenAI 官方原生支持 Responses API，Codex 可直接接入
    codexCompat: "responses",
    models: ["gpt-5.5", "gpt-5.2", "gpt-4o", "gpt-4.1", "o3", "o4-mini"],
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    consoleUrl: "https://console.anthropic.com",
    baseUrl: "https://api.anthropic.com",
    protocol: "anthropic",
    // Anthropic 使用自家协议，非 Responses，Codex 无法原生接入
    codexCompat: "unavailable",
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
    // Gemini 使用自家协议，Codex 无法原生接入
    codexCompat: "unavailable",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
  },
  {
    id: "qwen",
    name: "阿里通义 Qwen",
    consoleUrl: "https://bailian.console.aliyun.com",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    protocol: "openai",
    // 通义 DashScope 兼容模式主走 Chat Completions，Codex 需经网关协议转换接入
    codexCompat: "gateway",
    models: ["qwen3-max", "qwen3-coder", "qwen3.6", "qwen3-vl-plus", "qwen2.5-coder"],
  },
  {
    id: "siliconflow",
    name: "硅基流动 SiliconFlow",
    consoleUrl: "https://cloud.siliconflow.cn",
    baseUrl: "https://api.siliconflow.cn/v1",
    protocol: "openai",
    // 硅基流动走 Chat Completions，Codex 需经网关协议转换接入
    codexCompat: "gateway",
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
    // OpenRouter 走 Chat Completions，Codex 需经网关协议转换接入
    codexCompat: "gateway",
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
/**
 * Codex 内置（保留）provider ID：这些名字不能通过 -c 覆盖，否则
 * "model_providers contains reserved built-in provider IDs" 直接闪退。
 * 命中保留名时自动改用 "{id}-custom"（官方错误提示推荐的做法）。
 */
const CODEX_RESERVED_PROVIDERS = new Set([
  "openai",
  "deepseek",
  "together",
  "groq",
  "grok",
  "fireworks",
  "openrouter",
  "mistral",
  "cerebras",
  "glaive",
]);

/** 计算 Codex 可用的 provider ID：命中内置保留名时加 -custom 后缀 */
function customProviderId(id) {
  return CODEX_RESERVED_PROVIDERS.has(id) ? `${id}-custom` : id;
}

/**
 * Codex 兼容能力：
 * 2026-02 起 Codex 强制使用 Responses API，config.toml 的 wire_api 枚举只剩 responses，
 * 传 chat_completions 会报 "unknown variant `chat_completions`, expected `responses`" 并闪退。
 * 因此对 Codex 而言，接入某个厂商的前提是它能产出 Responses 协议。
 *
 * 三级能力：
 * - codexCompat === "responses"   → 厂商原生提供 Responses API（/responses），wire_api=responses 直接可用
 * - codexCompat === "gateway"     → 厂商只提供 OpenAI 兼容的 Chat Completions（GLM/Kimi/Qwen/硅基/OpenRouter 等），
 *   Codex 无法原生接入，但可经内建本地网关（lib/proxy.js）自动做 Responses↔Chat 协议转换，真正可用
 * - codexCompat === "unavailable" → 厂商使用自有协议（Anthropic / Gemini 等），内建网关无法翻译，需另行处理
 */
/**
 * Codex 接入兼容性判定。返回 { ok, wireApi, gateway?, upstreamBase?, reason? }：
 * ok=true
 *   - 无 gateway      → 可原生接入，wire_api=responses，base_url 直接用厂商原始地址
 *   - 带 gateway=true → 需经内建本地网关：wire_api=responses，base_url 指向本地代理，由代理转发厂商
 * ok=false → 该厂商使用自有协议，内建网关也无法接入（reason 说明原因与出路）
 */
function codexCompatInfo(providerId) {
  const p = PROVIDER_BY_ID.get(providerId);
  if (!p) return { ok: false, wireApi: "unavailable", reason: "unknown-provider" };
  if (p.codexCompat === "responses") {
    return { ok: true, wireApi: "responses" };
  }
  if (p.codexCompat === "gateway") {
    return {
      ok: true,
      wireApi: "responses",
      gateway: true,
      upstreamBase: p.baseUrl,
      target: p.name,
    };
  }
  return {
    ok: false,
    wireApi: "unavailable",
    reason:
      `${p.name} 使用自有协议（非 OpenAI Chat Completions），内建网关无法做 Responses↔Chat 转换，` +
      `而 Codex 只认 Responses 协议。` +
      `可选方案：① 改用原生支持 Responses 的厂商（如 DeepSeek V4 / OpenAI）；` +
      `② 改用提供 OpenAI 兼容 Chat Completions 的厂商（如 GLM / Kimi / 通义 / 硅基流动）。`,
  };
}

const COMPAT_TARGETS = {
  codex: {
    name: "Codex",
    kind: "env",
    env: [
      ["OPENAI_API_KEY", "{key}"],
    ],
    // Codex 不吃 OPENAI_BASE_URL 环境变量（model_provider 以 config.toml 为准），
    // 必须用 -c 覆盖强制指定 provider，否则用户已有的 config.toml 会把请求发错地方。
    // 注意：内置 provider ID（openai/deepseek 等）不允许覆盖，命中时自动改名为 {id}-custom。
    cliOverrides: [
      ["model", "{model}"],
      ["model_provider", "{providerId}"],
      ["model_providers.{providerId}.name", "{providerId}"],
      ["model_providers.{providerId}.base_url", "{baseUrl}"],
      ["model_providers.{providerId}.env_key", "OPENAI_API_KEY"],
      ["model_providers.{providerId}.wire_api", "{wireApi}"],
    ],
    note: "Codex 需在 config.toml 配 model_provider，或由一键启动自动加 -c 覆盖（内置 provider 名自动加 -custom 避免冲突）",
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
    modelArg: ["--model", "{model}"],
  },
  aider: {
    name: "Aider",
    kind: "env",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_API_BASE", "{baseUrl}"],
    ],
    docs: "https://aider.chat",
    modelArg: ["--model", "{model}"],
  },
  "claude-code": {
    name: "Claude Code",
    kind: "env",
    env: [
      ["ANTHROPIC_AUTH_TOKEN", "{key}"],
      ["ANTHROPIC_BASE_URL", "{baseUrlAnthropic}"],
    ],
    docs: "https://claude.com/claude-code",
    modelArg: ["--model", "{model}"],
  },
  continue: {
    name: "Continue CLI",
    kind: "env",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_BASE_URL", "{baseUrl}"],
    ],
    docs: "https://github.com/continuedev/continue",
    modelArg: ["--model", "{model}"],
  },
  "qwen-code": {
    name: "Qwen Code",
    kind: "env",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_BASE_URL", "{baseUrl}"],
    ],
    docs: "https://github.com/QwenLM/qwen-code",
    modelArg: ["--model", "{model}"],
  },
  amp: {
    name: "Amp",
    kind: "env",
    env: [
      ["OPENAI_API_KEY", "{key}"],
      ["OPENAI_BASE_URL", "{baseUrl}"],
    ],
    docs: "https://ampcode.com",
    modelArg: ["--model", "{model}"],
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
    modelArg: ["--model", "{model}"],
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
    cmd: "coding-helper",
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
    providerId: provider.id,
    providerName: provider.name,
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
  const result = { file, lines, target, provider, kind: "env" };
  // 带 cliOverrides 的目标（如 Codex）：env 文件不够，附一条可直接运行的命令
  if (target.cliOverrides) {
    const compat = codexCompatInfo(provider.id);
    const local = {
      ...values,
      providerId: customProviderId(provider.id),
      wireApi: compat.wireApi,
    };
    const fill = (s) => s.replace(/\{(\w+)\}/g, (_, n) => local[n] ?? "");
    const pairs = target.cliOverrides.map(([k, v]) => `${fill(k)}=${fill(v)}`);
    // 走内建网关的厂商：本地代理端口是运行时动态分配的，静态命令无法预知，
    // 因此不拼 base_url，标记 needsGateway，由一键启动在运行时自动起代理再填地址。
    if (compat.gateway) {
      result.needsGateway = true;
      result.gatewayTarget = provider.name;
      return result;
    }
    result.command = `${targetId} ${pairs.flatMap((p) => ["-c", p]).join(" ")}`;
    // 厂商使用自有协议、内建网关也无法转换时：不生成必失败的 wire_api 参数，
    // 而是标记 blocked，让上层在启动前给出明确提示（而非默默生成必 404 的配置）。
    if (!compat.ok) {
      result.blocked = {
        reason: compat.reason,
        message:
          `Codex 只支持 OpenAI Responses 协议，而 ${provider.name} 使用自有协议，内建网关也无法转换，` +
          `该组合无法接入。\n建议：改用原生支持 Responses 的厂商（DeepSeek V4 / OpenAI），` +
          `或改用提供 OpenAI 兼容 Chat Completions 的厂商（GLM / Kimi / 通义 / 硅基流动）。`,
      };
    }
  }
  return result;
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
  customProviderId,
  codexCompatInfo,
  loadKeys,
  saveKeys,
  maskKey,
  targetSupportsProvider,
  buildCompat,
  buildCompatEnv,
};

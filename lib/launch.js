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
const {
  PROVIDERS,
  COMPAT_TARGETS,
  customProviderId,
  codexCompatInfo,
} = require("./api.js");
const { loadKeys, maskKey } = require("./config.js");
const { t } = require("./i18n.js");
const { hasCommand, installTool } = require("./tools.js");
const { pick, promptKeys } = require("./wizard.js");
const { startProxy } = require("./proxy.js");

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
    // 强制覆盖目标自身的 config，避免请求被发到错误的 provider。
    // providerId 命中 Codex 内置保留名（openai/deepseek 等）时加 -custom，
    // 否则 Codex 会因 "reserved built-in provider IDs" 直接闪退。
    if (target.cliOverrides) {
      const compat = codexCompatInfo(provider.id);
      const local = {
        ...values,
        providerId: customProviderId(provider.id),
        wireApi: compat.wireApi,
      };
      const fill = (s) => s.replace(/\{(\w+)\}/g, (_, n) => local[n] ?? "");
      // 走内建网关的厂商（GLM/Kimi 等）：base_url 取决于运行时分配的本地代理端口，
      // 无法在此静态拼接；先把网关参数带回，由 launchTool 起代理后补齐地址。
      if (compat.gateway) {
        // 保留 {baseUrl} 占位不替换（只替换其它字段），等 launchTool 拿到本地代理地址再填。
        const fillGateway = (s) =>
          s.replace(/\{(\w+)\}/g, (_, n) => (n === "baseUrl" ? "{baseUrl}" : local[n] ?? ""));
        out.gateway = {
          upstreamBase: compat.upstreamBase,
          target: compat.target,
          argsTemplate: target.cliOverrides.flatMap(([k, v]) => [
            "-c",
            `${fillGateway(k)}=${fillGateway(v)}`,
          ]),
        };
        return out;
      }
      out.args = target.cliOverrides.flatMap(([k, v]) => ["-c", `${fill(k)}=${fill(v)}`]);
      // 厂商使用自有协议、内建网关也无法转换（Anthropic/Gemini）→ 不生成必失败的
      // wire_api 参数，标记 blocked，由 launchTool 在启动前给出明确提示并中止。
      if (!compat.ok) {
        out.blocked = { reason: compat.reason };
      }
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

/**
 * 启动目标 CLI（继承终端，退出后返回）。
 * 对 Codex + GLM/Kimi 等组合，会先自动拉起内建本地协议网关（Responses→Chat），
 * 把 base_url 指到本地代理，Codex 退出后自动回收代理进程，用户全程无感知。
 */
async function launchTool(tool, provider, key, model) {
  const prepared = buildLaunchEnv(tool, provider, key, model);
  // Codex 等只认 Responses 协议、但厂商使用自有协议无法转换时，启动前明确提示并中止，
  // 避免生成必然 404 的配置 / 触发 config.toml 加载错误。
  if (prepared.blocked) {
    console.log(
      `\n${paint(C.red, t("launch_blocked", { tool: tool.name, provider: provider.name }))}`
    );
    console.log(paint(C.yellow, prepared.blocked.reason));
    console.log(paint(C.dim, t("launch_blocked_hint")));
    return;
  }
  if (prepared.file) {
    try {
      fs.mkdirSync(path.dirname(prepared.file), { recursive: true });
      fs.writeFileSync(prepared.file, JSON.stringify(prepared.content, null, 2));
    } catch (e) {
      console.log(paint(C.red, t("launch_failed", { msg: e.message, bin: tool.bin })));
      return;
    }
  }
  const env = { ...process.env, ...(prepared.env || {}) };

  // 网关接入：为 GLM/Kimi 等无 /responses 的厂商自动起本地代理，base_url 指向本地。
  let proxy = null;
  if (prepared.gateway) {
    try {
      proxy = await startProxy({
        upstreamBase: prepared.gateway.upstreamBase,
        apiKey: key,
        target: prepared.gateway.target,
      });
      console.log(
        paint(
          C.cyan,
          t("launch_gateway_up", { target: prepared.gateway.target, port: String(proxy.port) })
        )
      );
    } catch (e) {
      console.log(
        paint(C.red, t("launch_gateway_failed", { msg: e.message, target: prepared.gateway.target }))
      );
      console.log(paint(C.dim, t("launch_blocked_hint")));
      return;
    }
  }

  // 启动参数：cliOverrides（-c 覆盖）优先；否则把选中的模型传给工具（--model）
  const target = COMPAT_TARGETS[tool.id];
  let args;
  if (prepared.gateway && proxy) {
    // 把 argsTemplate 里的 {baseUrl} 占位换成本地代理地址
    args = prepared.gateway.argsTemplate.map((a) => a.replace("{baseUrl}", proxy.baseUrl));
  } else {
    args = prepared.args ?? (target && target.modelArg ? target.modelArg : []).map((a) =>
      a.replace(/\{(\w+)\}/g, (_, n) => ({ model })[n] ?? a)
    );
  }
  console.log(
    `\n${paint(C.bold + C.cyan, t("launch_starting", { tool: tool.name, model, provider: provider.name }))}`
  );
  console.log(paint(C.dim, t("launch_quit_hint", { bin: tool.bin })));
  if (args.length) console.log(paint(C.dim, `  参数: ${tool.bin} ${args.join(" ")}`));
  // 把终端完全交给子进程：关 raw、移除我们的 keypress 监听，停止 stdin 流动。
  // 注意：绝不能 removeAllListeners("data")——那是 readline.emitKeypressEvents 注册的
  // 内部数据监听器，删掉后 keypress 事件永远不再触发（emitKeypressEvents 有幂等保护，
  // 再次调用会直接返回而不重新注册），导致退出工具后主菜单按键全部失灵。
  try {
    process.stdin.setRawMode(false);
  } catch {}
  process.stdin.removeAllListeners("keypress");
  try {
    process.stdin.pause();
  } catch {}
  await new Promise((resolve) => {
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
      // 收回终端。readline 内部 data 监听器必须保留（见上方注释），
      // 否则 keypress 事件链断裂，主菜单按键会全部失灵。
      try {
        process.stdin.resume();
      } catch {}
      process.stdin.removeAllListeners("keypress");
      resolve();
    });
  });
  // 子进程退出后回收本地网关代理
  if (proxy) {
    try {
      await proxy.close();
    } catch {}
  }
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
    // 安装失败立即中止，避免继续启动时出现 'xxx' is not recognized 后闪回主菜单
    if (!res.ok) {
      console.log(paint(C.yellow, t("launch_install_failed_abort", { tool: tool.name })));
      await wait(2500);
      return false;
    }
  }

  // ⑤ 一键启动
  await launchTool(tool, provider, savedKey, modelName);
  return true;
}

module.exports = { runLaunch, buildLaunchEnv };

"use strict";

/**
 * ai-cli-hub 单元测试套件（CI 安全：纯逻辑，无网络 / 无 DPAPI / 无真实安装）。
 * 运行：node test/run-tests.js
 * 退出码：0 = 全部通过；1 = 有失败。
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

// 备份根目录指向临时目录：不依赖用户主目录写权限（CI / 沙箱友好）
process.env.AI_CLI_PLATFORM_BACKUP_DIR = path.join(os.tmpdir(), "ai-cli-hub-test-backups");
process.env.AI_CLI_PLATFORM_HOME = path.join(os.tmpdir(), "ai-cli-hub-test-home");

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n== ${title} ==`);
}

/* ─────────── 1. i18n 键完整性 ─────────── */
section("i18n 双语键完整性");
{
  const src = fs.readFileSync(path.join(ROOT, "lib/i18n.js"), "utf8");
  const zhBlock = src.match(/const zh = \{([\s\S]*?)\n\};/);
  const enBlock = src.match(/const en = \{([\s\S]*?)\n\};/);
  check("i18n 字典结构可解析", !!zhBlock && !!enBlock);
  const zh = new Set([...zhBlock[1].matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]));
  const en = new Set([...enBlock[1].matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]));
  check("zh 字典非空", zh.size > 100, `键数 ${zh.size}`);
  const used = new Set();
  for (const f of ["index.js", "lib/frame.js", "lib/tools.js", "lib/wizard.js", "lib/launch.js"]) {
    const c = fs.readFileSync(path.join(ROOT, f), "utf8");
    for (const m of c.matchAll(/\bt\("(\w+)"/g)) used.add(m[1]);
  }
  const missingZh = [...used].filter((k) => !zh.has(k));
  const missingEn = [...used].filter((k) => !en.has(k));
  check("所有 t() 键在 zh 中存在", missingZh.length === 0, missingZh.join(","));
  check("所有 t() 键在 en 中存在", missingEn.length === 0, missingEn.join(","));
}

/* ─────────── 2. 注册表完整性 ─────────── */
section("注册表与适配矩阵");
{
  const { TOOLS } = require(path.join(ROOT, "registry.js"));
  const { COMPAT_TARGETS, PROVIDERS } = require(path.join(ROOT, "lib/api.js"));
  const ids = TOOLS.map((t) => t.id);
  check("13 个工具", TOOLS.length === 13, `实际 ${TOOLS.length}`);
  check("工具 id 唯一", new Set(ids).size === ids.length);
  check("每个工具都有 homepage", TOOLS.every((t) => !!t.homepage));
  check("每个工具都有 dataDirs", TOOLS.every((t) => Array.isArray(t.dataDirs)));
  const noCompat = TOOLS.filter((t) => !COMPAT_TARGETS[t.id]).map((t) => t.id);
  check("13/13 工具都有适配条目", noCompat.length === 0, noCompat.join(","));
  const noModels = PROVIDERS.filter((p) => !p.models || p.models.length === 0).map((p) => p.id);
  check("所有提供商都有模型目录", noModels.length === 0, noModels.join(","));
  const modelCount = PROVIDERS.reduce((n, p) => n + p.models.length, 0);
  check("模型总数 > 40", modelCount > 40, `实际 ${modelCount}`);
}

/* ─────────── 3. 卸载确认决策 ─────────── */
section("卸载确认 decideConfirm");
{
  const { decideConfirm } = require(path.join(ROOT, "index.js"));
  check("w → confirm", decideConfirm({ sequence: "w" }) === "confirm");
  check("n → cancel", decideConfirm({ sequence: "n" }) === "cancel");
  check("Esc → cancel", decideConfirm({ sequence: "\u001b" }) === "cancel");
  check("Ctrl+C → exit", decideConfirm({ ctrl: true, name: "c" }) === "exit");
  check("Ctrl+Q → exit", decideConfirm({ ctrl: true, name: "q" }) === "exit");
  check("其他键 → remind", decideConfirm({ sequence: "y" }) === "remind");
}

/* ─────────── 4. Node 构建包映射 ─────────── */
section("nodeBuild 平台/架构映射");
{
  const { nodeBuild } = require(path.join(ROOT, "lib/env.js"));
  const cases = [
    ["win32", "x64", "node-v22.23.2-win-x64"],
    ["win32", "arm64", "node-v22.23.2-win-arm64"],
    ["win32", "ia32", "node-v22.23.2-win-x64"],
    ["darwin", "x64", "node-v22.23.2-darwin-x64"],
    ["darwin", "arm64", "node-v22.23.2-darwin-arm64"],
    ["linux", "x64", "node-v22.23.2-linux-x64"],
    ["linux", "arm64", "node-v22.23.2-linux-arm64"],
    ["linux", "arm", "node-v22.23.2-linux-armv7l"],
  ];
  for (const [platform, arch, expect] of cases) {
    const b = nodeBuild("v22.23.2", platform, arch);
    check(`${platform}/${arch} → ${expect}`, b && b.pkg === expect, b && b.pkg);
  }
  check("win 用 zip + Expand-Archive", nodeBuild("v22.23.2", "win32", "x64").unpack === "zip");
  check("linux 用 tar", nodeBuild("v22.23.2", "linux", "x64").unpack === "tar");
  check("未知平台返回 null", nodeBuild("v22.23.2", "freebsd", "x64") === null);
}

/* ─────────── 5. 兼容层 / 启动环境 ─────────── */
section("兼容层与启动环境");
{
  const { buildLaunchEnv } = require(path.join(ROOT, "lib/launch.js"));
  const {
    PROVIDER_BY_ID,
    codexCompatInfo,
    targetSupportsProvider,
  } = require(path.join(ROOT, "lib/api.js"));
  const { TOOLS } = require(path.join(ROOT, "registry.js"));
  const ds = PROVIDER_BY_ID.get("deepseek");
  const r1 = buildLaunchEnv({ id: "codex" }, ds, "sk-test", "deepseek-v4-pro");
  const r1args = (r1.args || []).join(" ");
  check("codex → OPENAI_API_KEY + -c 覆盖 provider(内置名加 -custom, wire_api=responses)",
    r1.env && r1.env.OPENAI_API_KEY === "sk-test"
      && r1args.includes("model=deepseek-v4-pro")
      && r1args.includes("model_provider=deepseek-custom")
      && r1args.includes("model_providers.deepseek-custom.base_url=https://api.deepseek.com")
      && r1args.includes("model_providers.deepseek-custom.env_key=OPENAI_API_KEY")
      && r1args.includes("wire_api=responses"));
  const r2 = buildLaunchEnv({ id: "claude-code" }, ds, "sk-test", "deepseek-v4-pro");
  check("claude-code → /anthropic 端点",
    r2.env && r2.env.ANTHROPIC_BASE_URL === "https://api.deepseek.com/anthropic");
  const r3 = buildLaunchEnv({ id: "deep-code" }, ds, "sk-test", "deepseek-v4-flash");
  check("deep-code → 配置文件模板", r3.file && r3.content.env.MODEL === "deepseek-v4-flash");
  let allOk = true;
  for (const tool of TOOLS) {
    try {
      const r = buildLaunchEnv(tool, ds, "sk-x", "deepseek-v4-pro");
      if (r.env && !Object.keys(r.env).length) allOk = false;
    } catch {
      allOk = false;
    }
  }
  check("13/13 工具启动环境可生成", allOk);
  const oa = PROVIDER_BY_ID.get("openai");
  const roa = buildLaunchEnv({ id: "codex" }, oa, "sk-test", "gpt-5.2");
  const roaArgs = (roa.args || []).join(" ");
  check("codex+openai → 官方端点用 responses(保留 ID 加 -custom)",
    roaArgs.includes("model_provider=openai-custom")
      && roaArgs.includes("base_url=https://api.openai.com/v1")
      && roaArgs.includes("wire_api=responses"));
  // DeepSeek V4 原生提供 Responses 端点，可直接接入 codex
  const dsCompat = codexCompatInfo("deepseek");
  check("deepseek V4 → 原生支持 responses，可接 codex",
    dsCompat.ok === true && dsCompat.wireApi === "responses");
  // 智谱 GLM 只提供 Chat Completions、无 /responses 端点 → 经内建网关自动协议转换，真正可用
  const zhipu = PROVIDER_BY_ID.get("zhipu");
  const rz = buildLaunchEnv({ id: "codex" }, zhipu, "sk-test", "glm-5.2");
  const zc = codexCompatInfo("zhipu");
  check("codex+智谱GLM → 走网关(ok=true, gateway 携带上游地址与命令模板)",
    zc.ok === true
      && zc.gateway === true
      && zc.upstreamBase === "https://open.bigmodel.cn/api/paas/v4"
      && rz.gateway
      && Array.isArray(rz.gateway.argsTemplate)
      && rz.gateway.argsTemplate.some((a) => a.includes("{baseUrl}")));
  // Anthropic 使用自有协议，内建网关也无法转换 → blocked
  const claude = PROVIDER_BY_ID.get("anthropic");
  const rc = buildLaunchEnv({ id: "codex" }, claude, "sk-test", "claude-opus-4.7");
  const cc = codexCompatInfo("anthropic");
  check("codex+Anthropic → 自有协议无法转换，标记 blocked",
    cc.ok === false && rc.blocked && typeof rc.blocked.reason === "string");
  check("deepseek → codex 兼容", targetSupportsProvider("codex", ds).ok);
  check("deepseek → claude-code 兼容(Anthropic端点)", targetSupportsProvider("claude-code", ds).ok);
  check("openai → claude-code 不兼容(预期)", !targetSupportsProvider("claude-code", oa).ok);
}

/* ─────────── 6. 镜像源区域映射 ─────────── */
section("镜像源区域映射");
{
  const { getNpmRegistry, getPipIndex, getNodeMirror } = require(path.join(ROOT, "lib/sources.js"));
  check("cn npm → npmmirror", getNpmRegistry("cn") === "https://registry.npmmirror.com");
  check("intl npm → npmjs", getNpmRegistry("intl") === "https://registry.npmjs.org");
  check("cn pip → 清华 TUNA", getPipIndex("cn").includes("tuna.tsinghua"));
  check("cn node → npmmirror", getNodeMirror("cn") === "https://npmmirror.com/mirrors/node");
}

/* ─────────── 7. 备份模块 ─────────── */
section("备份模块");
{
  const { backupTool } = require(path.join(ROOT, "lib/backup.js"));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aichub-test-"));
  fs.writeFileSync(path.join(tmp, "s.txt"), "hello");
  const r = backupTool({ id: "test-tool", dataDirs: [{ path: tmp, note: "t" }] });
  check("备份目录已创建", fs.existsSync(r.dest));
  check("备份内容正确", fs.readFileSync(path.join(r.dest, path.basename(tmp), "s.txt"), "utf8") === "hello");
  check("缺失目录自动跳过", r.missing.length === 0);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(r.dest, { recursive: true, force: true });
}

/* ─────────── 汇总 ─────────── */
console.log(`\n${"-".repeat(40)}`);
console.log(`结果: ${passed} 通过 / ${failed} 失败`);
if (failed > 0) {
  console.log("失败项:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("ALL TESTS PASSED ✅");

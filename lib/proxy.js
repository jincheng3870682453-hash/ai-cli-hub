"use strict";

/**
 * 内建本地协议转换网关（Responses → Chat Completions）。
 *
 * 为什么用它而不是 pip 装 LiteLLM：
 *   Codex CLI 自 2026-02 起只接受 wire_api = "responses"，而 GLM / Kimi 等厂商
 *   只提供 Chat Completions 端点。LiteLLM 能翻译协议，但依赖 Python + pip install
 *   'litellm[proxy]' + 一份 YAML 配置，安装重、易失败、还要额外进程管理。
 *
 *   这个模块用 Node 内置 http/https 实现与 LiteLLM 网关等价的核心能力：
 *   在本地监听一个端口，把 Codex 发来的 Responses 请求实时翻译成 Chat Completions
 *   转发到目标厂商，再把响应翻译回 Responses 格式。零外部依赖、即开即用、
 *   与宿主进程同生命周期，真正做到"启动即代理、退出即回收"。
 *
 * 使用方式（由 launch.js 自动调用，用户无感知）：
 *   const { startProxy } = require("./proxy.js");
 *   const proxy = await startProxy({ upstreamBase, apiKey, target, consoleUrl });
 *   // 把 Codex base_url 指到 proxy.baseUrl，wire_api="responses"
 *   // 用完 proxy.close()
 */

const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const { URL } = require("node:url");

/** 找一个空闲端口 */
function findFreePort(preferred) {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(preferred || 0, "127.0.0.1", () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

/** 读取请求体 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** 上游转发（HTTP/HTTPS 通用） */
function upstreamRequest(url, method, headers, body) {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) })
      );
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/** 抽取一段 JSON 里的原始 content 文本（兼容 content 为字符串或分段数组） */
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (p && typeof p.text === "string" ? p.text : ""))
      .join("");
  }
  return "";
}

/**
 * 把上游 Chat Completions 响应翻译成 Responses 响应。
 * 目标是一个可流式的 SSE 响应或普通 JSON 响应。
 */
function buildResponsesJson(chatBody) {
  const choice = chatBody.choices && chatBody.choices[0];
  const text = choice ? extractText(choice.message && choice.message.content) : "";
  const usage = chatBody.usage || {};
  const outputTokens =
    usage.completion_tokens != null ? usage.completion_tokens : usage.output_tokens;
  const inputTokens =
    usage.prompt_tokens != null ? usage.prompt_tokens : usage.input_tokens;
  const msgId = `chatcmpl-${Date.now().toString(36)}`;

  const output = [];
  if (text) {
    output.push({
      type: "message",
      id: `msg_${msgId}`,
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text, annotations: [] }],
    });
  }
  if (Array.isArray(choice && choice.tool_calls) && choice.tool_calls.length) {
    const calls = choice.tool_calls.map((tc, i) => ({
      type: "function_call",
      id: tc.id || `call_${msgId}_${i}`,
      call_id: tc.id || `call_${msgId}_${i}`,
      name: tc.function && tc.function.name,
      arguments: tc.function && tc.function.arguments,
    }));
    output.push(...calls);
  }
  const status = choice && (choice.finish_reason === "tool_calls" || (choice.tool_calls && choice.tool_calls.length)) ? "in_progress" : "completed";

  return {
    id: msgId,
    object: "response",
    created_at: Math.floor(Date.now() / 1000),
    status,
    model: chatBody.model,
    output,
    usage: {
      input_tokens: inputTokens || 0,
      input_tokens_details: { cached_tokens: usage.prompt_tokens_details?.cached_tokens || 0 },
      output_tokens: outputTokens || 0,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: usage.total_tokens || 0,
    },
  };
}

/** 把 Responses 请求体翻译成 Chat Completions 请求体 */
function buildChatBody(resp) {
  const messages = [];
  const toolCalls = []; // 一次会话内收集（同轮 tools 在同一请求里）

  // 历史消息
  if (Array.isArray(resp.input)) {
    for (const item of resp.input) {
      if (!item) continue;
      // 直接提供的历史消息（OpenAI 习惯）
      if (item.role) {
        messages.push({
          role: item.role,
          content: extractText(item.content),
        });
        continue;
      }
      // 分项格式：messages + function_call_output
      if (item.type === "message" && Array.isArray(item.content)) {
        const role = item.role || (item.content[0]?.type === "input_text" ? "user" : "assistant");
        messages.push({ role, content: extractText(item.content) });
      } else if (item.type === "function_call_output") {
        messages.push({
          role: "tool",
          tool_call_id: item.call_id,
          content: typeof item.output === "string" ? item.output : JSON.stringify(item.output),
        });
      } else if (item.type === "function_call") {
        toolCalls.push({
          id: item.call_id || item.id,
          type: "function",
          function: {
            name: item.name,
            arguments:
              typeof item.arguments === "string"
                ? item.arguments
                : JSON.stringify(item.arguments || {}),
          },
        });
      }
    }
  } else if (typeof resp.input === "string") {
    messages.push({ role: "user", content: resp.input });
  }

  // 最新一轮 assistant tool_calls 若存在，附加到最后一条 assistant 消息上
  if (toolCalls.length && messages.length) {
    const last = messages[messages.length - 1];
    if (last.role === "assistant") {
      if (Array.isArray(last.tool_calls)) last.tool_calls.push(...toolCalls);
      else last.tool_calls = toolCalls;
    } else {
      messages.push({ role: "assistant", content: "", tool_calls: toolCalls });
    }
  }

  // instructions → system
  if (typeof resp.instructions === "string" && resp.instructions) {
    messages.unshift({ role: "system", content: resp.instructions });
  }

  const body = {
    model: resp.model,
    messages,
    stream: resp.stream === true,
  };

  if (typeof resp.temperature === "number") body.temperature = resp.temperature;
  if (typeof resp.max_output_tokens === "number") body.max_tokens = resp.max_output_tokens;
  if (Array.isArray(resp.tools) && resp.tools.length) {
    body.tools = resp.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters || t.input_schema || {},
      },
    }));
  }
  if (Array.isArray(resp.tool_choice) && resp.tool_choice.length) {
    body.tool_choice = resp.tool_choice[0];
  }
  return body;
}

/** 流式 SSE：把上游 Chat 的 chunk 翻译成 Responses 的 chunk 事件 */
function makeSseTranslator(resp) {
  const msgId = `chatcmpl-${Date.now().toString(36)}`;
  let textAcc = "";
  let callAcc = {}; // 按 index 聚合 tool_call delta
  let roleSent = false;
  return function translateChunk(json, emit) {
    if (!json || json.error) {
      if (json && json.error) {
        emit(
          `event: error\ndata: ${JSON.stringify({
            type: "error",
            error: { code: json.error.code || "upstream_error", message: json.error.message || "upstream error" },
          })}\n\n`
        );
      }
      return;
    }
    const choice = json.choices && json.choices[0];
    const delta = choice && choice.delta;
    if (!delta) return;

    // 角色（只发一次）
    if (!roleSent && delta.role) {
      roleSent = true;
      emit(`data: ${JSON.stringify({ type: "response.created", response: { id: msgId, model: json.model, status: "in_progress" } })}\n\n`);
      emit(`data: ${JSON.stringify({ type: "response.output_item.added", output_index: 0, item: { id: `msg_${msgId}`, type: "message", role: "assistant", status: "in_progress", content: [] } })}\n\n`);
    }

    if (delta.content) {
      textAcc += delta.content;
      emit(`data: ${JSON.stringify({ type: "response.output_text.delta", item_id: `msg_${msgId}`, output_index: 0, content_index: 0, delta: delta.content })}\n\n`);
    }
    if (delta.tool_calls && delta.tool_calls.length) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index != null ? tc.index : 0;
        const acc = (callAcc[idx] = callAcc[idx] || { id: tc.id || `call_${msgId}_${idx}`, name: "", arguments: "" });
        if (tc.id) acc.id = tc.id;
        if (tc.function) {
          if (tc.function.name) acc.name += tc.function.name;
          if (tc.function.arguments) acc.arguments += tc.function.arguments;
        }
      }
    }
  };
}

/**
 * 启动一个本地协议转换代理。
 * opts: { upstreamBase, apiKey, target, consoleUrl }
 *   upstreamBase: 厂商原始 base_url，如 "https://open.bigmodel.cn/api/paas/v4"
 *   apiKey:        厂商 API Key（代理会原样转发给上游）
 *   target:        调试标识，如 "glm-5.2"
 * 返回: { baseUrl, port, close }
 */
async function startProxy({ upstreamBase, apiKey, target = "unknown", consoleUrl = "" }) {
  let upstream;
  try {
    upstream = new URL(upstreamBase);
  } catch {
    throw new Error(`startProxy: invalid upstreamBase "${upstreamBase}"`);
  }

  // 归一化上游模型端点：Chat Completions 是 {base}/chat/completions
  const chatEndpoint = new URL(upstream);
  const rawPath = chatEndpoint.pathname.replace(/\/+$/, "");
  chatEndpoint.pathname = rawPath.endsWith("/chat/completions")
    ? rawPath
    : `${rawPath}/chat/completions`;

  const server = http.createServer(async (req, res) => {
    // 只接受 /responses 与 /v1/responses（Codex 会访问 /responses）
    const reqUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
    const isResponses =
      reqUrl.pathname.endsWith("/responses") || reqUrl.pathname.includes("/responses");

    try {
      const bodyBuf = req.method === "POST" ? await readBody(req) : Buffer.alloc(0);
      const resp = bodyBuf.length ? JSON.parse(bodyBuf.toString("utf8")) : {};

      // 透传模型名映射：若上游需要模型前缀/别名，可由调用方通过 upstreamModel 指定
      if (req.headers["x-codebuddy-model"]) {
        resp.model = req.headers["x-codebuddy-model"];
      }

      const chatBody = isResponses ? buildChatBody(resp) : resp;
      const stream = chatBody.stream === true;

      const headers = {
        "content-type": "application/json",
        authorization: req.headers.authorization || (apiKey ? `Bearer ${apiKey}` : ""),
        accept: stream ? "text/event-stream" : "application/json",
      };
      // 透传自定义头（如 x-api-key）
      if (apiKey && !headers.authorization) headers.authorization = `Bearer ${apiKey}`;

      const up = await upstreamRequest(
        chatEndpoint,
        "POST",
        headers,
        JSON.stringify(chatBody)
      );

      if (stream) {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        });
        const emit = (s) => res.write(s);
        // 首帧（Response created）
        emit(`data: ${JSON.stringify({ type: "response.created", response: { id: `resp_${Date.now().toString(36)}`, model: chatBody.model, status: "in_progress" } })}\n\n`);

        const translator = makeSseTranslator(resp);
        const text = up.body.toString("utf8");
        // 兼容上游以 \n\n 分隔的 SSE
        const events = text.split(/\n\n+/);
        for (const evt of events) {
          const line = evt.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") {
            emit(`data: ${JSON.stringify({ type: "response.completed", response: { id: `resp_${Date.now().toString(36)}`, model: chatBody.model, status: "completed" } })}\n\n`);
            emit("data: [DONE]\n\n");
            continue;
          }
          let j;
          try {
            j = JSON.parse(data);
          } catch {
            continue;
          }
          translator(j, emit);
        }
        res.end();
      } else {
        let payload;
        try {
          payload = isResponses ? buildResponsesJson(JSON.parse(up.body.toString("utf8"))) : JSON.parse(up.body.toString("utf8"));
        } catch {
          res.writeHead(502, { "content-type": "text/plain" });
          res.end("proxy: bad upstream response");
          return;
        }
        if (up.status >= 400) {
          res.writeHead(up.status, { "content-type": "application/json" });
          res.end(up.body);
          return;
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      }
    } catch (e) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { code: "proxy_error", message: e.message } }));
    }
  });

  const port = await findFreePort();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    port,
    upstream: chatEndpoint.href,
    target,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        // 兜底：强制清掉 keep-alive 连接
        server.closeAllConnections && server.closeAllConnections();
      }),
  };
}

module.exports = { startProxy, buildChatBody, buildResponsesJson, findFreePort };

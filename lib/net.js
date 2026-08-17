"use strict";

/**
 * 网络层：带超时的 fetchJson，以及 npm registry / GitHub 的地址构造。
 * 网络失败不抛异常（返回 null），让上层走缓存/离线兜底。
 */

const TIMEOUT_MS = 8000;

/** 带超时的 JSON 请求；失败返回 null */
async function fetchJson(url, { timeoutMs = TIMEOUT_MS } = {}) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "ai-cli-install-platform/0.1" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { __raw: text };
    }
  } catch {
    return null;
  }
}

/** 裸文本请求（raw.githubusercontent 等）；失败返回 null */
async function fetchText(url, { timeoutMs = TIMEOUT_MS } = {}) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "ai-cli-install-platform/0.1" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** npm 包信息（dist-tags / description）；失败返回 null */
async function fetchNpmInfo(pkg, { registry } = {}) {
  // scoped 包 @scope/name 在 URL 中要编码成 @scope%2Fname
  const encoded = pkg.startsWith("@")
    ? `@${pkg.slice(1).replace("/", "%2F")}`
    : pkg;
  const base = registry || "https://registry.npmjs.org";
  const json = await fetchJson(`${base}/${encoded}`);
  if (!json || typeof json !== "object") return null;
  return {
    latest: json["dist-tags"]?.latest ?? null,
    description: json.description ?? null,
  };
}

/** GitHub 仓库信息；失败返回 null */
async function fetchGitHubRepo(repo) {
  const json = await fetchJson(`https://api.github.com/repos/${repo}`);
  if (!json || typeof json !== "object") return null;
  return {
    defaultBranch: json.default_branch ?? "master",
    description: json.description ?? null,
    stars: json.stargazers_count ?? 0,
    pushedAt: json.pushed_at ?? null,
  };
}

/**
 * PyPI 包信息；失败返回 null。
 * 注意：PyPI 的 /json 返回全量发布历史（几十 MB），这里流式读取、
 * 解析到 "info" 对象结束就中止，避免下载整个大 JSON。
 */
async function fetchPypiInfo(pkg) {
  try {
    const res = await fetch(`https://pypi.org/pypi/${pkg}/json`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "ai-cli-install-platform/0.1" },
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = "";
    let infoJson = null;
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (value) {
        acc += decoder.decode(value, { stream: !done });
        total += value.length;
        const start = acc.indexOf('"info"');
        if (start !== -1) {
          const braceStart = acc.indexOf("{", start);
          let depth = 0;
          for (let i = braceStart; i < acc.length; i++) {
            const ch = acc[i];
            if (ch === "{") depth++;
            else if (ch === "}") {
              depth--;
              if (depth === 0) {
                infoJson = JSON.parse(acc.slice(braceStart, i + 1));
                break;
              }
            }
          }
        }
        if (infoJson) break;
        if (total > 8 * 1024 * 1024) break; // 防呆：最多 8MB
      }
      if (done) break;
    }
    try {
      reader.cancel();
    } catch {}
    if (!infoJson) return null;
    return {
      latest: infoJson.version ?? null,
      description: infoJson.summary ?? null,
    };
  } catch {
    return null;
  }
}

module.exports = { fetchJson, fetchText, fetchNpmInfo, fetchGitHubRepo, fetchPypiInfo, TIMEOUT_MS };

"use strict";

/**
 * 版本拉取：从官方源（npm registry / GitHub raw）拉每个工具的最新版本，
 * 结果缓存到 .version-cache.json；网络失败时回退到缓存，标记 offline。
 */

const fs = require("node:fs");
const path = require("node:path");
const { fetchNpmInfo, fetchGitHubRepo, fetchPypiInfo, fetchText } = require("./net.js");
const { getNpmRegistry } = require("./sources.js");

const CACHE_FILE = path.join(__dirname, "..", ".version-cache.json");

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    /* 写缓存失败不影响主流程 */
  }
}

/**
 * 拉单个工具的最新版本。
 * 返回 { version, description, source, offline } 或 null。
 * offline=true 表示用的是缓存（网络不可达或失败）。
 * region: "cn" | "intl" —— npm 版本查询走对应镜像。
 */
async function fetchToolVersion(tool, cache, region = null) {
  const hit = cache[tool.id];
  if (tool.kind === "npm") {
    const info = await fetchNpmInfo(tool.pkg, { registry: region ? getNpmRegistry(region) : undefined });
    if (info) {
      const entry = {
        version: info.latest,
        description: info.description || tool.note || "",
        source: `npm:${tool.pkg}${region ? ` (${getNpmRegistry(region)})` : ""}`,
        offline: false,
      };
      cache[tool.id] = entry;
      return entry;
    }
  } else if (tool.kind === "pip") {
    const info = await fetchPypiInfo(tool.pkg);
    if (info) {
      const entry = {
        version: info.latest,
        description: info.description || tool.note || "",
        source: `pypi:${tool.pkg}`,
        offline: false,
      };
      cache[tool.id] = entry;
      return entry;
    }
  } else if (tool.kind === "ps1-oneliner") {
    // 从仓库根 package.json 读版本号
    const rawUrl = `https://raw.githubusercontent.com/${tool.repo}/${tool.branch}/package.json`;
    const raw = await fetchText(rawUrl);
    if (raw) {
      try {
        const pkg = JSON.parse(raw);
        const entry = {
          version: pkg.version ?? null,
          description: pkg.description || tool.note || "",
          source: `github:${tool.repo}@${tool.branch}`,
          offline: false,
        };
        cache[tool.id] = entry;
        return entry;
      } catch {
        /* 解析失败走缓存 */
      }
    }
    // raw 失败但缓存里有真实版本号时，保留缓存（不降级成低质量信息）
    if (hit && hit.version && !String(hit.version).includes("仓库")) {
      return { ...hit, offline: true };
    }
    // 兜底：至少确认仓库存在 + 默认分支
    const repo = await fetchGitHubRepo(tool.repo);
    if (repo) {
      const entry = {
        version: `(仓库 ${repo.defaultBranch})`,
        description: repo.description || tool.note || "",
        source: `github:${tool.repo}`,
        offline: false,
      };
      cache[tool.id] = entry;
      return entry;
    }
  }
  // 网络失败：回退缓存
  if (hit) return { ...hit, offline: true };
  return null;
}

/** 拉全部工具版本；返回 { id: entry }，并把缓存写盘 */
async function refreshAll(tools, region = null) {
  const cache = loadCache();
  const results = {};
  await Promise.all(
    tools.map(async (tool) => {
      results[tool.id] = await fetchToolVersion(tool, cache, region);
    })
  );
  saveCache(cache);
  return results;
}

/** 只读缓存（离线快速路径） */
function cachedAll(tools) {
  const cache = loadCache();
  const results = {};
  for (const tool of tools) {
    const hit = cache[tool.id];
    results[tool.id] = hit ? { ...hit, offline: true } : null;
  }
  return results;
}

module.exports = { refreshAll, cachedAll };

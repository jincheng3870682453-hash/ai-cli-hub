"use strict";

/**
 * 网络区域检测：判断用户是国内（cn）还是国外（intl）IP，
 * 用于自动切换镜像源。多接口兜底 + 结果缓存（内存 + 磁盘）。
 *
 * 判定依据：geo 接口返回 country == "CN" / "China" / 文本含「中国」 → cn
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CACHE_FILE = path.join(
  process.env.AI_CLI_PLATFORM_HOME || path.join(os.homedir(), ".ai-cli-platform"),
  "region.json"
);

/** 依次尝试的 geo 接口（优先国内可达的） */
const ENDPOINTS = [
  {
    name: "ipinfo",
    url: "https://ipinfo.io/json",
    parse: (j) => (j && j.country ? (j.country === "CN" ? "cn" : "intl") : null),
  },
  {
    name: "ip.sb",
    url: "https://api.ip.sb/geoip",
    parse: (j) => {
      if (!j) return null;
      const c = String(j.country || "").toUpperCase();
      return c === "CN" || c === "CHINA" ? "cn" : c ? "intl" : null;
    },
  },
  {
    name: "ipip.net",
    url: "https://myip.ipip.net",
    parse: (text) => (text && text.includes("中国") ? "cn" : text ? "intl" : null),
  },
  {
    name: "ipapi",
    url: "https://ipapi.co/json",
    parse: (j) => (j && j.country ? (j.country === "CN" ? "cn" : "intl") : null),
  },
];

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
  } catch {
    return null;
  }
}

function saveCache(region) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ region, ts: Date.now() }));
  } catch {
    /* 缓存失败不影响 */
  }
}

/** 检测区域；返回 "cn" | "intl" | null（未知）。结果缓存 1 小时。 */
async function detectRegion({ force = false } = {}) {
  if (!force) {
    const cached = loadCache();
    if (cached && cached.region && Date.now() - cached.ts < 3600_000) {
      return cached.region;
    }
  }
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(ep.url, {
        signal: AbortSignal.timeout(6000),
        headers: { "User-Agent": "ai-cli-hub/0.2" },
      });
      if (!res.ok) continue;
      const text = await res.text();
      let parsed = null;
      try {
        parsed = ep.parse(JSON.parse(text));
      } catch {
        parsed = ep.parse(text);
      }
      if (parsed) {
        saveCache(parsed);
        return parsed;
      }
    } catch {
      /* 试下一个接口 */
    }
  }
  return null;
}

module.exports = { detectRegion };

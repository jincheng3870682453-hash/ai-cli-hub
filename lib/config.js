"use strict";

/**
 * 平台配置持久化：语言、安装路径、API Key。
 * 默认存于 %USERPROFILE%\.ai-cli-platform\（可用 AI_CLI_PLATFORM_HOME 覆盖，便于测试）。
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { encrypt, decrypt } = require("./crypto.js");

const CONFIG_DIR =
  process.env.AI_CLI_PLATFORM_HOME || path.join(os.homedir(), ".ai-cli-platform");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const KEYS_FILE = path.join(CONFIG_DIR, "api-keys.json");

function ensureDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/** 平台配置 { lang?, installDir? } */
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveConfig(cfg) {
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

/**
 * API Key 存储：落盘时用 DPAPI 加密（{ providerId: { enc, addedAt, name } }）。
 * 读取时解密；兼容旧版明文 { key }（解密失败时返回 key:null 并标记 legacy）。
 */
function loadKeys() {
  try {
    const raw = JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
    const out = {};
    for (const [id, v] of Object.entries(raw)) {
      if (!v) continue;
      if (v.enc) {
        out[id] = { key: decrypt(v.enc) ?? null, addedAt: v.addedAt, name: v.name };
      } else if (v.key) {
        out[id] = { key: v.key, addedAt: v.addedAt, name: v.name, legacy: true };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveKeys(keys) {
  ensureDir();
  const enc = {};
  for (const [id, v] of Object.entries(keys)) {
    if (!v || !v.key) continue;
    const cipher = encrypt(v.key);
    enc[id] = {
      enc: cipher || v.key, // 加密失败时退化为明文并保留（由上层提示风险）
      encrypted: !!cipher,
      addedAt: v.addedAt,
      name: v.name,
    };
  }
  fs.writeFileSync(KEYS_FILE, JSON.stringify(enc, null, 2));
  return enc;
}

/** 掩码显示 key（只留前 4 后 4） */
function maskKey(key) {
  if (!key) return "";
  if (key.length <= 10) return "***";
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  KEYS_FILE,
  loadConfig,
  saveConfig,
  loadKeys,
  saveKeys,
  maskKey,
};

"use strict";

/**
 * 平台配置持久化：语言、安装路径、API Key。
 * 默认存于 %USERPROFILE%\.ai-cli-platform\（可用 AI_CLI_PLATFORM_HOME 覆盖，便于测试）。
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

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

/** API Key 存储 { providerId: { key, addedAt } } */
function loadKeys() {
  try {
    return JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveKeys(keys) {
  ensureDir();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
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

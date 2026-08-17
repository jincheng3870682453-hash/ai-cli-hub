"use strict";

/**
 * 卸载前数据备份：把工具的用户数据目录（配置/会话/凭证）复制到备份目录。
 *
 * 只复制「存在」的路径；路径不存在自动跳过（猜测的目录名不会报错）。
 *
 * ⚠️ 编码安全：备份目录默认放在用户主目录（%USERPROFILE%\.ai-cli-platform\backups），
 * 全 ASCII 路径，避免平台所在的中文目录名在某些终端/编码环境下被乱码化
 * （历史上出现过备份落到乱码目录的问题）。可用环境变量
 * AI_CLI_PLATFORM_BACKUP_DIR 自定义备份位置。
 */

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BACKUP_ROOT =
  process.env.AI_CLI_PLATFORM_BACKUP_DIR ||
  path.join(os.homedir(), ".ai-cli-platform", "backups");

/** 展开 ~ 为用户主目录 */
function expandDataDir(p) {
  if (!p || p === "~") return os.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/**
 * 备份一个工具的数据目录。
 * 返回 { dest, saved: [{path, note}], missing: [string] }。
 * saved 为空表示没有可备份的数据。
 */
function backupTool(tool) {
  const dest = path.join(BACKUP_ROOT, `${tool.id}-${timestamp()}`);
  const saved = [];
  const missing = [];

  for (const entry of tool.dataDirs || []) {
    const src = expandDataDir(entry.path);
    if (!fs.existsSync(src)) {
      missing.push(entry.path);
      continue;
    }
    // 目标子目录名：优先用路径的末段，避免多个目录同名冲突时追加序号
    let name = path.basename(src) || "home";
    let target = path.join(dest, name);
    let i = 2;
    while (fs.existsSync(target)) {
      target = path.join(dest, `${name}-${i++}`);
    }
    fs.cpSync(src, target, { recursive: true });
    saved.push({ path: entry.path, note: entry.note || "", target });
  }

  return { dest, saved, missing };
}

/** 返回备份根目录下该工具的所有备份 */
function listBackups(toolId) {
  try {
    const prefix = `${toolId}-`;
    return fs
      .readdirSync(BACKUP_ROOT)
      .filter((n) => n.startsWith(prefix))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

module.exports = { backupTool, listBackups, expandDataDir, BACKUP_ROOT };

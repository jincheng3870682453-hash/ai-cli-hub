"use strict";

/**
 * 终端帧渲染：把平台状态渲染成文本行，并支持「行级增量 diff」。
 *
 * 为什么做 diff：整屏清空（\x1b[2J）再重绘在经典 conhost 上非常慢，
 * 方向键高频触发会明显卡顿。这里只对「变化了的行」重绘 + \x1b[K 清尾，
 * 未变化的行完全不动。
 */

const { t } = require("./i18n.js");

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
};

const TTY = process.stdout.isTTY;
const paint = (code, s) => (TTY ? `${code}${s}${C.reset}` : s);
const pad = (s, n) => String(s).padEnd(n);

/**
 * 生成一帧的全部文本行。
 * state: { tools, versions, statusCache, selected, busy, pendingConfirm, logo }
 *   versions:     Map id → { version, offline } | null
 *   statusCache:  Map id → { installed, version } | null
 */
function buildFrame(state) {
  const { tools, versions, statusCache, selected, busy, pendingConfirm, logo } = state;
  const rows = [];
  // logo 是多行 ASCII 图：必须拆成独立行，否则内嵌换行符会撞乱整帧定位
  for (const line of String(logo || "").split("\n")) {
    rows.push(paint(C.cyan, line));
  }
  rows.push(paint(C.bold + C.cyan, t("frame_title")));
  rows.push("");
  tools.forEach((tool, i) => {
    const st = (statusCache && statusCache.get(tool.id)) || { installed: false, version: null };
    // versions 兼容 Map 或普通对象两种形态
    const v = versions
      ? versions.get
        ? versions.get(tool.id)
        : versions[tool.id]
      : null;
    const cursor = i === selected ? paint(C.cyan + C.bold, "❯") : " ";
    const mark = st.installed ? paint(C.green, "✓") : paint(C.dim, "✗");
    const latest = v
      ? `${v.version}${v.offline ? paint(C.yellow, "*") : ""}`
      : paint(C.red, "?");
    const inst = st.installed
      ? paint(C.green, t("frame_installed", { version: st.version ? ` ${st.version}` : "" }))
      : "";
    rows.push(
      ` ${cursor} ${mark} ${pad(tool.name, 22)}${pad(tool.vendor, 26)}${t("frame_latest")} ${pad(latest, 14)}${inst}${paint(
        C.magenta,
        ` [${tool.tag}]`
      )}`
    );
  });
  rows.push("");
  rows.push(paint(C.dim, t("frame_footer")));
  if (busy) rows.push(paint(C.yellow, t("busy")));
  if (pendingConfirm) {
    const name = pendingConfirm.tool?.name ?? "";
    rows.push(paint(C.yellow, t("confirm_prompt", { name })));
    if (pendingConfirm.reminded) {
      rows.push(paint(C.yellow, t("confirm_remind")));
    }
  }
  return rows;
}

/**
 * 计算从 prev 帧到 next 帧的增量 ANSI 输出。
 * 返回 { out, rows }：out 是要写入的字符串，rows 是新的帧行。
 */
function renderDiff(prev, next) {
  let out = "";
  for (let i = 0; i < next.length; i++) {
    const prevLine = prev[i] ?? "";
    if (prevLine !== next[i]) {
      const len = Math.max(prevLine.length, next[i].length);
      out += `\x1b[${i + 1};1H` + next[i].padEnd(len) + "\x1b[K";
    }
  }
  for (let i = next.length; i < prev.length; i++) {
    out += `\x1b[${i + 1};1H\x1b[K`;
  }
  return { out, rows: next };
}

module.exports = { C, paint, pad, buildFrame, renderDiff };

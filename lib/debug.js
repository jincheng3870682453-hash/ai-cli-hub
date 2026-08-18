"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DEBUG_LOG = path.join(
  process.env.AI_CLI_PLATFORM_HOME || path.join(os.homedir(), ".ai-cli-platform"),
  "debug.log"
);

function dbg(msg) {
  try {
    fs.mkdirSync(path.dirname(DEBUG_LOG), { recursive: true });
    fs.appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    /* 日志失败不影响主流程 */
  }
}

module.exports = { dbg, DEBUG_LOG };

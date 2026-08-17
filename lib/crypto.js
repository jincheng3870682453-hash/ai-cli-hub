"use strict";

/**
 * API Key 加密存储：用 Windows DPAPI（绑定当前用户 + 机器）加密。
 * 密文只有本机当前用户能解开——换机器/换用户后无法解密。
 * 实现方式：PowerShell 调用 System.Security.Cryptography.ProtectedData。
 * 非 Windows 环境：返回 null，由调用方决定回退策略。
 */

const { spawnSync } = require("node:child_process");

function ps(script) {
  try {
    const r = spawnSync(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      { encoding: "utf8", shell: false, timeout: 20000 }
    );
    if (r.status === 0 && r.stdout) return r.stdout.trim();
  } catch {
    /* ignore */
  }
  return null;
}

/** 加密；返回 base64 密文，失败返回 null */
function encrypt(plain) {
  if (!plain) return null;
  const b64 = Buffer.from(plain, "utf8").toString("base64");
  const script =
    `[System.Reflection.Assembly]::LoadWithPartialName('System.Security') | Out-Null;` +
    `[Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect(` +
    `[Convert]::FromBase64String('${b64}'), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))`;
  return ps(script);
}

/** 解密；返回明文，失败返回 null */
function decrypt(b64) {
  if (!b64) return null;
  const script =
    `[System.Reflection.Assembly]::LoadWithPartialName('System.Security') | Out-Null;` +
    `[Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Unprotect(` +
    `[Convert]::FromBase64String('${b64}'), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))`;
  const out = ps(script);
  if (!out) return null;
  try {
    return Buffer.from(out, "base64").toString("utf8");
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt };

# 🐼 AI CLI 安装平台

自动从**官方源**拉取各家终端编程工具的最新版本，一键安装、验证、**卸载（先备份数据）**。

> 核心价值：**真伪校验**。npm 上的裸名包很多是冒名包（比如 `kimi-cli` 是第三方冒名的，
> 官方的是 `@moonshot-ai/kimi-code`；`qwen-code`、`continue`、`goose` 的裸名包也都是无关项目）。
> 本平台注册表里的每个包名/仓库都经过人工核对官方文档确认。

## 🪳 吉祥物：小强（原创，无商标风险）

平台吉祥物是一只**横着爬的胖小强**（蟑螂）——宽扁俯视造型：两根长触角、大眼睛、
胖胖的甲壳、三对腿（见 `assets/logo.txt` ASCII 版 / `assets/logo.svg` 矢量版）。

> 为什么是小强？因为安装平台就该像小强一样：**打不死、到处都能装** 😄
> 蟑螂是通用动物形象，**不是任何公司/产品的吉祥物或标志**，不涉及 DeepSeek、
> Kimi、Claude 等任何品牌形象，可放心使用。

## 快速开始

```powershell
cd "C:\Users\69215\Desktop\AI-CLI-安装平台"
node index.js            # 交互式菜单（↑/↓ 选择，Enter 安装）
```

双击 `启动安装平台.cmd` 也可以（自动找 Node）。

## 交互菜单快捷键

| 键 | 功能 |
|---|---|
| `↑` / `↓` | 选择工具（**行级增量渲染，流畅不卡顿**） |
| `Enter` | 安装选中的工具 |
| `v` | 验证选中工具（where + --version） |
| `r` | 重新拉取版本 |
| `u` | 卸载（**先备份数据 → 按键确认 y/n → 才卸载**） |
| `i` | 查看工具详情与说明 |
| `q` / `Ctrl+C` | 退出 |

## 卸载 = 先备份，再确认，才卸载

按 `u` 或 `--uninstall` 时，平台会先把该工具的用户数据目录
（配置 / 会话 / 凭证，见注册表 `dataDirs`）复制到备份目录。

- **备份位置**：`%USERPROFILE%\.ai-cli-platform\backups\<工具id>-<时间戳>\`
  （全 ASCII 路径，避免中文目录名在某些终端下被编码乱码化；可用环境变量
  `AI_CLI_PLATFORM_BACKUP_DIR` 自定义位置）
- 备份失败（文件占用/权限）会**中止卸载**，保护你的数据
- 交互模式确认是 **w / n 制（防误触）**：
  - 按 **`w`**（小写）→ 确认卸载
  - 按 **`n`**（小写）→ 取消卸载
  - `Esc` / `Ctrl+C` → 退出（特殊键，不提醒）
  - **其他任何键**（含大写 W/N、回车、空格等）→ **只提醒一次「请按 w 或者 n」**，
    不做任何操作，等你按正确的键
- 命令行模式：默认自动备份后卸载；加 `--no-backup` 跳过备份
- 备份包含 API Key 等凭证，请妥善保管、用完可删

## 命令行模式（脚本/CI 友好）

```powershell
node index.js --list                      # 列出工具 + 安装状态 + 最新版本
node index.js --refresh                   # 从官方源拉取全部最新版本
node index.js --info deepseek-cli         # 单个工具详情
node index.js --install kimi-code         # 非交互安装
node index.js --verify codex              # 验证安装
node index.js --uninstall opencode        # 卸载（先备份数据）
node index.js --uninstall codex --no-backup   # 卸载（跳过备份）
```

## 支持的工具（13 个）

| id | 工具 | 来源 | 类型 | 数据目录（卸载前备份） |
|---|---|---|---|---|
| `deepseek-cli` | DeepSeek CLI（自研） | github.com/jincheng3870682453-hash/DeepSeek-CLI | 一行脚本 | ~/.dsh 等 |
| `kimi-code` | Kimi Code | npm `@moonshot-ai/kimi-code` | npm -g | ~/.kimi-code |
| `claude-code` | Claude Code | npm `@anthropic-ai/claude-code` | npm -g | ~/.claude |
| `codex` | Codex | npm `@openai/codex` | npm -g | ~/.codex |
| `opencode` | OpenCode | npm `opencode-ai` | npm -g | ~/.config/opencode |
| `gemini-cli` | Gemini CLI | npm `@google/gemini-cli` | npm -g | ~/.gemini |
| `qwen-code` | Qwen Code | npm `@qwen-code/qwen-code` | npm -g | ~/.qwen |
| `deep-code` | Deep Code（DeepSeek V4） | npm `@vegamo/deepcode-cli` | npm -g | ~/.deepcode |
| `amp` | Amp | npm `@ampcode/cli` | npm -g | ~/.amp |
| `aider` | Aider | PyPI `aider-chat` | pip | ~/.aider.conf.yml |
| `continue` | Continue CLI | npm `@continuedev/cli` | npm -g | ~/.continue |
| `aiconn` | AIConn | npm `aiconn` | npm -g | ~/.aiconn |
| `zhipu-helper` | 智谱 GLM 助手 | npm `@z_ai/coding-helper` | npm -g | — |

> 注 1：**DeepSeek Harness (dsh) 官方引擎不单列**——DeepSeek-CLI 安装脚本已自动内置
> （`npm install -g @deepseek-ai/dsh`），且官方 Harness 本身是 Web 网页版而非终端工具。
> 注 2：goose（Block 的开源 agent）官方安装脚本地址已失效（仓库已改名），安装方式未核实，暂未收录。

## 版本拉取与离线兜底

- 版本从官方源实时拉取：npm registry / PyPI / GitHub raw。
- 结果缓存到 `.version-cache.json`；网络不可达时自动回退缓存并标注「(缓存)」。

## 安全说明

- 安装会执行 `npm install -g ...`、`pip install ...` 或官方一行安装脚本（`irm ... | iex`）——与手动安装完全一致。
- DeepSeek CLI 的安装脚本会下载便携 Node 并写入 `%LOCALAPPDATA%\DeepSeek-CLI`、全局安装 `@deepseek-ai/dsh`。
- 卸载备份会复制配置/凭证到 `backups/`，仅保存在本机，请妥善保管、用完可删。
- 注册表是静态 JS（`registry.js`），新增工具 = 加一条记录；**添加前请先核对官方来源**。

## 新增工具（3 步）

1. 在 `registry.js` 的 `TOOLS` 数组加一条：
   - `kind: "npm"`：填官方 `pkg` 和 `bin`；
   - `kind: "pip"`：填 PyPI 包名和 `bin`；
   - `kind: "ps1-oneliner"`：填 `repo` / `branch` / `onelinerUrl` / `bin`。
   - 顺手填 `dataDirs`（用户数据目录，卸载前会备份）。
2. 用 `node index.js --refresh` 确认能拉到版本。
3. `node index.js --info <id>` 确认详情正确。

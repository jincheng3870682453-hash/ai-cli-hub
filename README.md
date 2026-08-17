# 🪳 AI CLI 安装平台（ai-cli-hub）

[![Version](https://img.shields.io/badge/Version-0.2.0-4D6BFE)](https://github.com/jincheng3870682453-hash/ai-cli-hub)
[![License](https://img.shields.io/badge/License-MIT-4D6BFE)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-4D6BFE)](https://github.com/jincheng3870682453-hash/ai-cli-hub)

自动从**官方源**拉取各家终端编程工具的最新版本，一键安装、验证、**卸载（先备份数据）**。
支持 **中/英双语切换**、**自定义安装路径**、**API Key 管理与兼容层**
（任意 OpenAI/Anthropic 兼容 key 接入目标 CLI，例如 DeepSeek 的 key 直接接 Codex）。

> 核心价值：**真伪校验**。npm 上的裸名包很多是冒名包（比如 `kimi-cli` 是第三方冒名的，
> 官方的是 `@moonshot-ai/kimi-code`；`qwen-code`、`continue`、`goose` 的裸名包也都是无关项目）。
> 本平台注册表里的每个包名/仓库都经过人工核对官方文档确认。

## 📥 获取本项目（拉取）

```powershell
# 方式一：git clone（推荐）
git clone https://github.com/jincheng3870682453-hash/ai-cli-hub.git
cd ai-cli-hub

# 方式二：下载 ZIP
# 打开 https://github.com/jincheng3870682453-hash/ai-cli-hub → 绿色 [Code] 按钮 → Download ZIP
```

**零 npm 依赖**（纯 Node 标准库），clone 后直接运行，无需 `npm install`：

```powershell
node index.js            # 交互式菜单（↑/↓ 选择，Enter 安装）
```

## 🪳 吉祥物：小强（原创，无商标风险）

平台吉祥物是一只**横着爬的胖小强**（蟑螂）——宽扁俯视造型：两根长触角、大眼睛、
胖胖的甲壳、三对腿（见 `assets/logo.txt` ASCII 版 / `assets/logo.svg` 矢量版）。

> 为什么是小强？因为安装平台就该像小强一样：**打不死、到处都能装** 😄
> 蟑螂是通用动物形象，**不是任何公司/产品的吉祥物或标志**，不涉及 DeepSeek、
> Kimi、Claude 等任何品牌形象，可放心使用。

## 快速开始

```powershell
# 1. 拉取本项目（首次）
git clone https://github.com/jincheng3870682453-hash/ai-cli-hub.git
cd ai-cli-hub

# 2. 直接运行（零依赖，无需 npm install）
node index.js            # 交互式菜单（↑/↓ 选择，Enter 安装）
```

> 没有 Node.js？平台会自动检测并在启动时引导安装；Windows 也可以直接双击
> `启动安装平台.cmd`（自动找 Node，没有就自动下载便携版）。
> 首次运行会自动检测网络区域（国内/国外）并切换合适的镜像源。

## 🧭 主菜单（三步向导，零门槛）

启动后是主菜单，三个入口：

1. **引导配置**（推荐）：**选 API Key 提供商 → 输入 key（加密保存）→ 选模型 → 选工具 → 未装自动下载 → 自动生成兼容配置**
   - 模型目录覆盖 9 家主流提供商（DeepSeek V4 Pro/Flash、Kimi K2.x、GLM-5.x、GPT-5.x、Claude Opus 4.x、Gemini 2.5、Qwen3…）
   - 任意公司的 key 都能尝试接任意工具：兼容组合直接生成配置；不兼容组合给出官方文档与替代方案（如 OpenRouter 聚合）
2. **下载 / 拉取工具**：工具列表界面（安装/验证/卸载/刷新）
3. **已配置概览**：当前语言、安装路径、API Key 与兼容配置

```powershell
node index.js --wizard    # 直接进入引导向导
```

## 🔐 API Key 加密存储

- Key 使用 **Windows DPAPI** 加密后落盘（`%USERPROFILE%\.ai-cli-platform\api-keys.json`），
  密文仅本机当前用户可解——换机器/换用户无法解密
- 加密失败（非 Windows / 无 PowerShell）时会明确警告并退化为明文
- 兼容旧版明文格式：读取时自动识别

## 交互菜单快捷键

| 键 | 功能 |
|---|---|
| `↑` / `↓` | 选择工具（**行级增量渲染，流畅不卡顿**） |
| `Enter` | 安装选中的工具 |
| `v` | 验证选中工具（where + --version） |
| `r` | 重新拉取版本 |
| `u` | 卸载（**先备份数据 → 按键确认 y/n → 才卸载**） |
| `i` | 查看工具详情与说明 |
| `q` / `Ctrl+Q` / `Ctrl+C` | 退出 / 返回上一级 |

> 输入 API Key 等场景：`Ctrl+C` / `Ctrl+Q` / `Esc` 取消输入。

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
node index.js --urls                      # 列出所有工具的官方网址（防假站）
node index.js --refresh                   # 从官方源拉取全部最新版本
node index.js --info deepseek-cli         # 单个工具详情
node index.js --install kimi-code         # 非交互安装
node index.js --verify codex              # 验证安装
node index.js --uninstall opencode        # 卸载（先备份数据）
node index.js --uninstall codex --no-backup   # 卸载（跳过备份）
node index.js --doctor                    # 环境与网络诊断（缺什么自动装什么）
node index.js --region                    # 查看网络区域（国内/国外）与所用镜像源
node index.js --version                   # 平台版本
```

## 🔧 环境自动检测 + 国内/国外源自动切换

平台会自动做两件事：

1. **环境检测**（`--doctor`）：检查 Node.js / npm / git / python / pip 是否安装，
   **缺什么自动装什么**——git / python 走 `winget` 自动安装；Node 缺失时
   `启动安装平台.cmd` 会自动下载便携版（先试官方源，失败自动切国内镜像）。
2. **网络区域检测**（`--region`）：自动识别你是国内还是国外 IP——
   - **国内** → 自动用国内镜像：npm 走 `registry.npmmirror.com`（阿里）、
     pip 走清华 TUNA、Node 下载走 npmmirror
   - **国外** → 自动用官方源（npmjs / pypi.org / nodejs.org）

无需任何手动配置，安装与版本拉取全程自动走对应源。

## 🌐 中 / 英双语

```powershell
node index.js --lang en        # 切到英文
node index.js --lang zh        # 切回中文
AI_CLI_LANG=en node index.js   # 或用环境变量
```
语言优先级：`--lang` 参数 > 环境变量 `AI_CLI_LANG` > 配置文件 > 系统区域（默认中文）。
全套界面（菜单、安装/卸载/备份/验证提示、兼容层输出）均已汉化。

## 📂 自定义安装路径

```powershell
node index.js --install-dir "D:\tools\ai-clis"
```
设置后，npm / pip 类工具会安装到该路径（`npm --prefix` / `pip --prefix`）；
需自行把该路径加入 PATH。查看当前配置：`node index.js --config`。

## 🔑 API Key 管理（调研了 9 家主流提供商）

```powershell
node index.js --api                     # 列出提供商 + key 配置状态
node index.js --api add deepseek sk-xxx # 保存某个提供商的 key
node index.js --api remove openai       # 删除
```
已收录提供商：`deepseek`（深度求索）· `moonshot`（Kimi）· `zhipu`（智谱 GLM）·
`openai` · `anthropic` · `gemini`（Google）· `qwen`（阿里通义）·
`siliconflow`（硅基流动）· `openrouter`。key 保存在
`%USERPROFILE%\.ai-cli-platform\api-keys.json`（本机明文，注意保管）。

## 🔌 兼容层：任意 key 接入目标 CLI

```powershell
node index.js --compat codex --provider deepseek
# → 生成 codex-deepseek.env，内含 OPENAI_API_KEY + OPENAI_BASE_URL
#   即 DeepSeek 的 key 直接驱动 OpenAI 系产品（Codex / OpenCode / Aider / Continue / Qwen Code / Amp）
```
- **13 个工具全部有适配方案**，三种适配方式自动选择：
  - **环境变量**（`.env` 文件）：codex / opencode / aider / claude-code / continue / qwen-code / amp / gemini-cli / deepseek-cli
  - **配置文件**（直接写入）：deep-code（`~/.deepcode/settings.json`，原文件自动备份 `.bak`）
  - **自带配置界面**（给出命令）：kimi-code（`kimi /provider`）/ aiconn / 智谱助手
- OpenAI 兼容提供商 → 生成 `OPENAI_API_KEY` + `OPENAI_BASE_URL`
- Anthropic 兼容（`claude-code`）→ 生成 `ANTHROPIC_AUTH_TOKEN` + `ANTHROPIC_BASE_URL`
  （DeepSeek / Kimi / 智谱都提供 `/anthropic` 端点）
- 不兼容组合不会让你卡住：给出官方文档 + 替代方案（如 OpenRouter 一个 key 通吃所有协议）
- 环境变量文件位于 `%USERPROFILE%\.ai-cli-platform\compat\`，按提示注入即可

## 支持的工具（13 个）

| id | 工具 | 官方网址 | 类型 | 数据目录（卸载前备份） |
|---|---|---|---|---|
| `deepseek-cli` | DeepSeek CLI（自研） | github.com/jincheng3870682453-hash/DeepSeek-CLI | 一行脚本 | ~/.dsh 等 |
| `kimi-code` | Kimi Code | kimi.com/code | npm -g | ~/.kimi-code |
| `claude-code` | Claude Code | claude.com/claude-code | npm -g | ~/.claude |
| `codex` | Codex | github.com/openai/codex | npm -g | ~/.codex |
| `opencode` | OpenCode | opencode.ai | npm -g | ~/.config/opencode |
| `gemini-cli` | Gemini CLI | github.com/google-gemini/gemini-cli | npm -g | ~/.gemini |
| `qwen-code` | Qwen Code | github.com/QwenLM/qwen-code | npm -g | ~/.qwen |
| `deep-code` | Deep Code（DeepSeek V4） | api-docs.deepseek.com/quick_start/agent_integrations/deepcode/ | npm -g | ~/.deepcode |
| `amp` | Amp | ampcode.com | npm -g | ~/.amp |
| `aider` | Aider | aider.chat | pip | ~/.aider.conf.yml |
| `continue` | Continue CLI | github.com/continuedev/continue | npm -g | ~/.continue |
| `aiconn` | AIConn | npmjs.com/package/aiconn | npm -g | ~/.aiconn |
| `zhipu-helper` | 智谱 GLM 助手 | docs.bigmodel.cn/cn/coding-plan/extension/coding-tool-helper | npm -g | — |

> 完整网址列表随时可查：`node index.js --urls`
> 注 1：**DeepSeek Harness (dsh) 官方引擎不单列**——DeepSeek-CLI 安装脚本已自动内置
> （`npm install -g @deepseek-ai/dsh`），且官方 Harness 本身是 Web 网页版而非终端工具。
> 注 2：goose（Block 的开源 agent）官方安装脚本地址已失效（仓库已改名），安装方式未核实，暂未收录。

## 版本拉取与离线兜底

- 版本从官方源实时拉取：npm registry / PyPI / GitHub raw。
- 结果缓存到 `.version-cache.json`；网络不可达时自动回退缓存并标注「(缓存)」。

## 安全说明

- 安装会执行 `npm install -g ...`、`pip install ...` 或官方一行安装脚本（`irm ... | iex`）——与手动安装完全一致。
- DeepSeek CLI 的安装脚本会下载便携 Node 并写入 `%LOCALAPPDATA%\DeepSeek-CLI`、全局安装 `@deepseek-ai/dsh`。
- 卸载备份复制配置/凭证到 `%USERPROFILE%\.ai-cli-platform\backups\`，仅保存在本机，请妥善保管、用完可删。
- API Key 以明文保存在 `%USERPROFILE%\.ai-cli-platform\api-keys.json`，**不要**提交到任何仓库。
- 注册表是静态 JS（`registry.js`），新增工具 = 加一条记录；**添加前请先核对官方来源**。

## 🌍 社区

- 本仓库：<https://github.com/jincheng3870682453-hash/ai-cli-hub>（提 issue / PR / star ⭐）
- 作者 GitHub：<https://github.com/jincheng3870682453-hash>
- 姊妹项目 DeepSeek CLI：<https://github.com/jincheng3870682453-hash/DeepSeek-CLI>（基于 DeepSeek Harness 的终端 Agent）

## 新增工具（3 步）

1. 在 `registry.js` 的 `TOOLS` 数组加一条：
   - `kind: "npm"`：填官方 `pkg` 和 `bin`；
   - `kind: "pip"`：填 PyPI 包名和 `bin`；
   - `kind: "ps1-oneliner"`：填 `repo` / `branch` / `onelinerUrl` / `bin`。
   - 顺手填 `dataDirs`（用户数据目录，卸载前会备份）。
2. 用 `node index.js --refresh` 确认能拉到版本。
3. `node index.js --info <id>` 确认详情正确。

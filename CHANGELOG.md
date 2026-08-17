# Changelog

本项目所有值得记录的版本变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.2] - 2026-08-17

### 🎉 上线
- 发布到 GitHub：<https://github.com/jincheng3870682453-hash/ai-cli-hub>

### ✨ 新增
- **API Key 加密存储**：改用 Windows DPAPI 加密落盘（`api-keys.json` 只存密文，仅本机可解）；加密失败自动降级并警告；兼容旧版明文格式
- **三步引导向导**（主菜单第 1 项）：选提供商 → 输 Key（掩码+加密）→ 选模型（可自定义）→ 选工具 → 未装自动下载 → 自动生成兼容配置
- **模型目录全面化**：9 家提供商共 54 个模型（DeepSeek V4 Pro/Flash、Kimi K2.x、GLM-5.x、GPT-5.x、Claude Opus 4.x、Gemini 2.5、Qwen3、硅基流动、OpenRouter）
- **13/13 工具适配矩阵**：环境变量 / 配置文件（deep-code 带 `.bak` 备份）/ 自带配置界面三种适配方式
- **一键启动**（主菜单第 4 项 + `--launch`）：选模型 → 选 Key → 选工具 → 注入环境后直接启动，退出自动返回主菜单；启动参数自动携带 `--model`

### 🐛 修复
- 主菜单方向键失效（缺 raw 模式）
- API Key 输入框按 `q` 无法退出 → 统一退出键 **Ctrl+Q**（全界面），输入框支持 Ctrl+C/Ctrl+Q/Esc 取消
- 工具列表偶现重复行/幽灵行（帧渲染改整帧覆盖重绘，自愈错位）
- 已安装工具重复联网拉版本 → 已装工具只显示本地版本，不再联网
- `i`/`v` 查看结果被立即重绘盖掉 → 打印后等任意键返回
- 已配置概览闪退 / `os is not defined`（缺 `node:os` 导入）
- 一键启动"启动错误"：启动前完全交出终端（移除按键监听+暂停 stdin），并传递所选模型

## [0.2.1] - 2026-08-17

### ✨ 新增
- **环境自动检测与安装**：`--doctor` 检查 Node/npm/git/python/pip，缺什么自动装什么（git/python 走 winget）
- **网络区域检测**：`--region` 自动识别国内/国外 IP（多接口兜底 + 缓存）
- **镜像源自动切换**：国内 → npmmirror（npm）/ 清华 TUNA（pip）/ npmmirror-node；国外 → 官方源；安装与版本拉取全程自动走对应源
- 启动器 `.cmd`：缺 Node 自动下载便携版（官方源失败自动切国内镜像）

### 📝 文档
- 快速开始改为 `git clone` 流程，去掉硬编码本机路径

## [0.2.0] - 2026-08-17

### ✨ 新增
- **中/英双语**：`--lang zh|en` / `AI_CLI_LANG` 环境变量，全套界面 150+ 文案键 zh/en 全覆盖
- **自定义安装路径**：`--install-dir <dir>`（npm/pip 走 `--prefix`），配置持久化
- **API Key 管理**：`--api list|add|remove`，收录 9 家主流提供商
- **兼容层**：`--compat <目标> --provider <id>`，OpenAI 兼容（codex/opencode/aider/continue/qwen-code）+ Anthropic 兼容（claude-code）
- `--urls`：列出全部工具官方网址（防假站）；`--version` / `--config`
- 吉祥物换为**小强（蟑螂）**：原创横版造型，ASCII + SVG

### 🐛 修复
- 渲染卡顿：行级增量渲染 → 整帧覆盖重绘优化
- 文档：拉取方式、版本徽章、网址表、社区链接

## [0.1.0] - 2026-08-17

### ✨ 首发
- 13 个工具注册表（全部人工核对官方源，防冒名包）
- 版本实时拉取（npm registry / PyPI / GitHub raw）+ 离线缓存兜底
- 交互菜单（方向键选择、安装/验证/卸载/刷新）+ 命令行模式
- **卸载前自动备份**用户数据（配置/会话/凭证），备份失败中止卸载
- 卸载确认 w/n 制 + 防误触提醒
- 原创吉祥物（初始为熊猫，后改为小强）

---

[unreleased]: https://github.com/jincheng3870682453-hash/ai-cli-hub/compare/master...HEAD
[0.2.2]: https://github.com/jincheng3870682453-hash/ai-cli-hub/releases/tag/v0.2.2
[0.2.1]: https://github.com/jincheng3870682453-hash/ai-cli-hub/releases/tag/v0.2.1
[0.2.0]: https://github.com/jincheng3870682453-hash/ai-cli-hub/releases/tag/v0.2.0
[0.1.0]: https://github.com/jincheng3870682453-hash/ai-cli-hub/releases/tag/v0.1.0

# 🗺️ 需求待办（Roadmap）

## ✅ 已完成（v0.2.0）

- [x] **1. 自定义下载 / 安装路径** — `--install-dir <dir>`（npm/pip 走 --prefix），配置持久化
- [x] **2. 全程双语（中 / 英切换 + 汉化）** — `--lang zh|en` / 环境变量 `AI_CLI_LANG`，
      全套界面（菜单、安装/卸载/备份/验证、兼容层）87 个文案键 zh/en 全覆盖
- [x] **3. API Key 管理** — 调研收录 9 家主流提供商（DeepSeek/Kimi/智谱/OpenAI/Anthropic/
      Gemini/Qwen/硅基流动/OpenRouter），`--api list|add|remove`
- [x] **4. 兼容层** — `--compat <目标> --provider <id>`：OpenAI 兼容（codex/opencode/aider/
      continue/qwen-code）+ Anthropic 兼容（claude-code，DeepSeek/Kimi/智谱提供 /anthropic 端点）
- [x] **5. 发布到 GitHub** — 仓库 ai-cli-hub 已上线，README 含拉取方式/版本徽章/网址表/社区

## ⏳ 待办（未开工）

- [ ] 工具数继续扩充（goose 待官方安装方式核实后收录）
- [ ] 兼容层：直接写目标 CLI 配置文件（opencode auth.json / codex config.toml），而不只是环境变量
- [ ] 一键安装便携版（打包 node.exe 的绿色版，类似 DeepSeek-CLI-Portable）
- [ ] 自动更新检查（对比 GitHub 最新 release）
- [ ] 卸载备份：可选压缩为 zip，支持备份恢复命令

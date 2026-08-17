# 🗺️ 需求待办（Roadmap）

> 以下需求由用户提出，**暂缓实施**（2026-08-17 记录）。
> 实施顺序可调整，每项完成前应先与用户确认细节。

## 1. 自定义下载 / 安装路径
- 用户可自定义工具安装到哪里（当前是 npm 全局 / 默认路径）
- 需要：安装前询问目标路径；不同安装方式（npm -g 的 prefix、便携版目录）的路径覆盖逻辑

## 2. 全程双语（中 / 英切换 + 汉化）
- 下载 / 安装 / 卸载 / 提示信息全套支持中文与英文
- 启动时可选择语言，或读取系统/环境变量；中文用户默认汉化
- 涉及：所有 CLI 输出、交互菜单、提示语、README

## 3. API Key 管理（调研 + 自填）
- 先调研市面上有多少家主流模型 API Key 提供商（DeepSeek / Kimi / 智谱 / OpenAI / Anthropic / Gemini / Qwen / 通义 / 硅基流动等）
- 用户可自行提供 API Key，选择是哪家模型
- 选好模型后即可开始使用

## 4. 兼容层（任意 OpenAI 兼容 API Key 接入）
- 目标：不是某产品的官方 key，也能接到 CLI 平台使用
- 例：**DeepSeek 的 API Key 能接上 OpenAI 系的产品**（OpenAI 兼容协议互通）
- 需要：各家 API 端点 / 协议（OpenAI-compatible / Anthropic / 专有）的映射与转换层

## 5. 发布到 GitHub
- 用户已创建（或即将创建）GitHub 仓库
- 平台代码整理为可开源状态：.gitignore、LICENSE、README、无敏感数据

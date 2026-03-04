<div align="center">
  <img src="./docs/logo.svg" alt="OpenClaw Logo" width="160"/>
  <h1>OpenClaw Node</h1>
  <p>现代 AI 任务执行桌面客户端</p>
</div>

![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri)
![Rust](https://img.shields.io/badge/Rust-1.80+-F46623?logo=rust)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css)

OpenClaw Node 是一个基于 Tauri 2 和 React 构建的现代 AI 任务执行桌面客户端。它作为一个本地节点（Node），专门负责与云端进行通信、执行端侧自动化任务，并提供原生的操作系统集成。

## 🌟 核心特性

- **跨平台桌面应用**：得益于 [Tauri 2](https://v2.tauri.app/) 架构，应用体积小巧且占用极低，支持 Windows、macOS 和 Linux。
- **现代化前端界面**：基于 React 18 驱动，配合 Zustand 状态管理与 Tailwind CSS 极速且优雅的构建界面。
- **原生系统集成**：
  - 🖥 系统托盘管理，支持后台静默运行
  - 🔔 原生系统通知接入
  - 📁 本地数据持久化存储
  - ⚡ 高性能 Rust 核心层
- **实时通信**：内置 WebSocket 网关客户端，确保服务端与受控端节点之间的低延迟指令接收与反馈。

## 🛠 技术栈

- **前端架构**
  - React 18
  - React Router DOM v6
  - Zustand
  - Tailwind CSS
  - Vite

- **核心层 (Rust / Tauri)**
  - Tauri v2 框架
  - Tokio
  - Reqwest
  - Tokio-Tungstenite (WebSocket 通信)

## 🚀 快速开始

### 运行环境要求

在开始之前，请确保你的开发机器上已经安装了以下依赖：
- **Node.js** (推荐 >=18.x)
- **Rust** 编译器与 Cargo 工具链 (推荐最新的稳定版)

### 环境安装与运行

1. **克隆项目并安装前端依赖**
   ```bash
   npm install
   ```

2. **本地开发调试**
   ```bash
   # 启动 Vite 开发服务器并拉起 Tauri 桌面端窗口
   npm run tauri:dev
   ```

3. **构建生产版本包**
   ```bash
   npm run tauri:build
   ```

## 📂 项目结构

```text
easy-openclaw/
├── src/                # 前端 React 源码目录
├── src-tauri/          # Tauri Rust 后端源码目录
├── docs/               # 文档与资源文件 (含项目 Logo)
├── sidecar/            # 可选的外部附属模块/脚本
└── package.json        # 前端依赖与脚手架命令
```

## 🤝 参与贡献

欢迎任何形式的贡献和 PR！

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 发起 Pull Request

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可协议。

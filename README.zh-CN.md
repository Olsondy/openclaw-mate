<div align="center">
  <img src="./docs/logo.svg" alt="OpenClaw Logo" width="160"/>
  <h1>OpenClaw Node（openclaw-exec）</h1>
  <p>多租户私有化平台的桌面执行节点</p>

  [English](./README.md) | **简体中文**
</div>

![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri)
![Rust](https://img.shields.io/badge/Rust-1.80+-F46623?logo=rust)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css)

## 简介

**openclaw-exec** 是 Easy OpenClaw 多租户平台的**桌面端执行节点**，基于 Tauri 2 + React 18 构建。

每个获得授权的用户在本地运行一个 exec 实例，它负责：
1. 向 **openclaw-tenant** 进行 Token 验证（HWID 绑定）
2. 通过 WebSocket 长连接至用户**专属** openclaw Gateway 实例（由 tenant 动态创建的 Docker/Podman 容器）
3. 接收云端 AI Agent 下发的任务并在本地执行，将执行结果回传

> **1 个 Token = 1 个 Gateway 容器 = 1 个 exec 客户端**，三者一一对应，互相隔离。

---

## 🏗️ 在整体架构中的位置

```
服务端（自托管）
├── openclaw-tenant（控制平面）── 管理 Token / 编排容器
└── openclaw Gateway A/B/C（容器）── 每用户独享，端口隔离
                △
                │ wss:// 长连接（WebSocket）
                │
客户端（用户本地）
└── openclaw-exec（本模块）── 桌面应用，执行本地任务
        ↑
        │ ① POST /api/verify → tenant 验证 token + machine_id
        │   返回 { allowed, message }
        │
        │ ② wss:// 连接对应 Gateway，发送 connect 握手帧
        │   接收 node.invoke 指令 → 本地执行 → 回传结果
```

详细架构请参考父仓库 [README](../README.md)。

---

## 🔄 关键交互流程

### ① License 激活（首次运行）

```
用户在 Settings 输入 licenseKey
  → [Rust auth_client] POST /api/verify
      { hwid, licenseKey, deviceName, publicKey }
      ↓
  Tenant 校验并返回：
      { success, data: { nodeConfig: { gatewayUrl, gatewayToken, gatewayWebUI,
                                       agentId, deviceName, licenseId },
                         userProfile, needsBootstrap } }
      ↓
  exec 将 nodeConfig 持久化至本地 config.json
  → 自动用 gatewayToken 连接 gatewayUrl
```

> `gatewayToken` 由 tenant 在每次 verify 时自动轮换（过期后），TTL 可配置，默认 30 天。exec 下次启动时静默重新 verify，用户无感知。

### ② Gateway 长连接

```
[Rust ws_client] 读取 config.json 中的 gatewayUrl + gatewayToken
  → 建立 wss://gatewayUrl?token=gatewayToken
  → 发送 connect 握手帧：
      { type: "req", method: "connect",
        params: { role: "node", scopes: ["node.execute"],
                  auth: { token }, device: { id, publicKey, signature, ... } } }
  → Gateway 校验 paired.json 中的设备身份
  → 返回 { type: "res", ok: true } + 可选 deviceToken
  → React UI 展示在线状态
```

### ③ 任务执行

```
Gateway 推送 { type: "req", method: "node.invoke",
               payload: { command, args } }
  ├── system.run → Rust 直接执行本地 shell 命令
  └── browser.* / vision.* → stdin IPC → Sidecar 子进程（Node.js）
                                        → stdout IPC 回传结果
  → Rust 回传 { type: "res", ok, payload: { stdout, stderr, exitCode, durationMs } }
  → AI Agent 收到执行反馈
```

### 支持的命令

| 命令 | 执行层 | 状态 |
|------|--------|------|
| `system.run` | Rust（直接执行） | ✅ 已实现 |
| `browser.navigate` | Node.js sidecar · Playwright | ✅ 已实现 |
| `browser.screenshot` | Node.js sidecar · Playwright | ✅ 已实现 |
| `browser.click` | Node.js sidecar · Playwright | ✅ 已实现 |
| `browser.type` | Node.js sidecar · Playwright | ✅ 已实现 |
| `vision.screenshot` | Node.js sidecar · Playwright | ✅ 已实现 |

---

## 🆕 最新补充（tenant 契约对齐 + API 向导）

- **verify 契约对齐 tenant**：
  - `hwid` 使用 `device_identity.device_id`
  - verify 请求上报 `deviceName` 与 `publicKey`
  - 消费 tenant 返回的 `nodeConfig.gatewayUrl` 字段用于连接
- **新增模型 API 配置向导（后置手动入口）**：
  - 入口位于 Settings 页面
  - 严格 provider 下拉选择，`modelId/modelName/apiKey` 必填
  - 默认空值不预填
  - 提交到 `POST /api/licenses/:id/bootstrap-config` 的 `modelAuth`
  - 该覆盖配置仅写入节点配置文件，不在 tenant 服务侧持久化
- **飞书向导 HWID 来源同步更新**：
  - 使用 `device_identity.device_id`，与 verify 一致

---

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| **UI 前端** | React 18 · React Router v6 · Zustand · Tailwind CSS · Vite |
| **Rust 核心层** | Tauri v2 · Tokio · Tokio-Tungstenite · Reqwest · ed25519-dalek |
| **安全身份** | ed25519 密钥对（本地生成持久化）· SHA-256 deviceId 派生 |
| **Sidecar** | Node.js 子进程（browser / system / vision 高阶任务） |

---

## 📂 项目结构

```text
openclaw-exec/
├── src/                 # React 前端源码（UI / 状态管理 / 页面）
├── src-tauri/           # Tauri Rust 核心层
│   └── src/
│       ├── auth_client.rs      # Token 验证逻辑
│       ├── ws_client.rs        # WebSocket Gateway 长连接
│       ├── device_identity.rs  # ed25519 密钥对 & deviceId 派生
│       ├── config.rs           # 本地 config.json 持久化
│       └── main.rs             # Tauri 命令注册 & 应用入口
├── sidecar/             # Node.js 子进程（高阶任务处理）
└── package.json
```

---

## 🚀 快速开始

### 运行环境要求

| 工具 | 版本要求 |
|------|----------|
| Node.js | ≥ 18.x |
| Rust + Cargo | 最新稳定版 |
| pnpm | ≥ 10.x |

### 开发调试

```bash
# 安装 workspace 依赖（根目录 + sidecar）
pnpm install

# 初始化环境变量配置
cp .env.example .env
# 如果你的 tenant API 不是运行在 localhost:3000，请修改 .env 中的地址

# 启动 Vite 开发服务器 + Tauri 桌面窗口
pnpm run tauri:dev
```

### 生产构建

```bash
pnpm run tauri:build
```

### 常用检查命令

```bash
pnpm run check
pnpm run check:all
```

> 构建产物（安装包）位于 `src-tauri/target/release/bundle/`。

---

## ⚙️ 使用方式

1. 在 Settings 页面填写 Token 及各端点地址
2. 点击连接，exec 自动向 tenant 验证身份
3. 验证通过后自动连接专属 Gateway，React UI 显示在线状态
4. 云端 AI Agent 即可通过该节点下发本地执行任务

---

## 📄 许可证

本项目采用 [MIT License](LICENSE) 许可协议。

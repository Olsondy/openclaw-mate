<div align="center">
  <img src="./docs/logo.svg" alt="OpenClaw Logo" width="160"/>
  <h1>OpenClaw Node (openclaw-exec)</h1>
  <p>Desktop execution node for the multi-tenant self-hosted platform</p>

  **English** | [简体中文](./README.zh-CN.md)
</div>

![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8DB?logo=tauri)
![Rust](https://img.shields.io/badge/Rust-1.80+-F46623?logo=rust)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css)

## Introduction

**openclaw-exec** is the **desktop execution node** of the Easy OpenClaw multi-tenant platform, built on Tauri 2 + React 18.

Each authorized user runs one exec instance locally, responsible for:
1. Performing License activation against **openclaw-tenant** (HWID binding + retrieving gateway config)
2. Maintaining a persistent WebSocket connection to the user's **dedicated** openclaw Gateway instance (a Docker/Podman container dynamically created by tenant)
3. Receiving tasks dispatched by cloud AI Agents, executing them locally, and returning results

> **1 License = 1 Gateway container = 1 exec client** — one-to-one mapping, fully isolated.

---

## 🏗️ Position in the Overall Architecture

```
Server (self-hosted)
├── openclaw-tenant (control plane) ── manages Licenses / orchestrates containers
└── openclaw Gateway A/B/C (containers) ── per-user dedicated, port-isolated
                △
                │ wss:// persistent connection (WebSocket)
                │
Client (user's local machine)
└── openclaw-exec (this module) ── desktop app, executes local tasks
        ↑
        │ ① First activation: POST /api/verify → tenant
        │   Returns gatewayUrl / gatewayToken / licenseId
        │
        │ ② wss:// connects to dedicated Gateway, sends connect handshake frame
        │   Receives node.invoke instructions → executes locally → returns result
```

For full architecture details, see the parent repo [README](../README.md).

---

## 🔄 Key Interaction Flows

### ① License Activation (first run)

```
User enters licenseKey in Settings
  → [Rust auth_client] POST /api/verify
      { hwid, licenseKey, deviceName, publicKey? }
      ↓
  Tenant validates and returns:
      { success, data: { nodeConfig: { gatewayUrl, gatewayToken, gatewayWebUI,
                                       agentId, deviceName, licenseId },
                         userProfile, needsBootstrap } }
      ↓
  exec persists nodeConfig to local config.json
  → auto-connects to gatewayUrl using gatewayToken
```

> `gatewayToken` is auto-rotated by tenant on each verify call when expired (TTL configurable, default 30 days). exec re-verifies transparently on next startup.

### ② Gateway Persistent Connection

```
[Rust ws_client] reads gatewayUrl + gatewayToken from config.json
  → establishes wss://gatewayUrl?token=gatewayToken
  → sends connect handshake frame:
      { type: "req", method: "connect",
        params: { role: "node", scopes: ["node.execute"],
                  auth: { token }, device: { id, publicKey, signature, ... } } }
  → Gateway validates device identity against paired.json
  → responds { type: "res", ok: true } + optional deviceToken
  → React UI shows online status
```

### ③ Task Execution

```
Gateway pushes { type: "req", method: "node.invoke",
                 payload: { command, args } }
  ├── system.run → Rust executes local shell command directly
  └── browser.* / vision.* → stdin IPC → Node.js Sidecar subprocess
                                        → stdout IPC returns result
  → Rust responds { type: "res", ok, payload: { stdout, stderr, exitCode, durationMs } }
  → AI Agent receives execution feedback
```

### Supported Commands

| Command | Handler | Status |
|---------|---------|--------|
| `system.run` | Rust (direct) | ✅ Implemented |
| `browser.navigate` | Node.js sidecar · Playwright | ✅ Implemented |
| `browser.screenshot` | Node.js sidecar · Playwright | ✅ Implemented |
| `browser.click` | Node.js sidecar · Playwright | ✅ Implemented |
| `browser.type` | Node.js sidecar · Playwright | ✅ Implemented |
| `vision.screenshot` | Node.js sidecar · Playwright | ✅ Implemented |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **UI Frontend** | React 18 · React Router v6 · Zustand · Tailwind CSS · Vite |
| **Rust Core** | Tauri v2 · Tokio · Tokio-Tungstenite · Reqwest · ed25519-dalek |
| **Security Identity** | ed25519 key pair (locally generated & persisted) · SHA-256 deviceId derivation |
| **Sidecar** | Node.js subprocess (browser / system / vision advanced tasks) |

---

## 📂 Project Structure

```text
openclaw-exec/
├── src/                 # React frontend (UI / state / pages)
├── src-tauri/           # Tauri Rust core layer
│   └── src/
│       ├── auth_client.rs      # POST /api/verify activation logic
│       ├── ws_client.rs        # WebSocket Gateway persistent connection
│       ├── device_identity.rs  # ed25519 key pair & deviceId derivation
│       ├── config.rs           # local config.json persistence
│       └── main.rs             # Tauri command registration & app entry
├── sidecar/             # Node.js subprocess (advanced task handling)
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18.x |
| Rust + Cargo | latest stable |
| pnpm | ≥ 10.x |

### Development

```bash
# Install workspace dependencies (root + sidecar)
pnpm install

# Initialize environment variables
cp .env.example .env
# Edit .env if your tenant API is not hosted at localhost:3000

# Start Vite dev server + Tauri desktop window
pnpm run tauri:dev
```

### Production Build

```bash
pnpm run tauri:build
```

### Common Check Commands

```bash
pnpm run check
pnpm run check:all
```

> Build artifacts (installers) are located at `src-tauri/target/release/bundle/`.

---

## ⚙️ Usage

1. Create a License in the **openclaw-tenant** admin panel to obtain a `token`
2. Enter the `token` and endpoint URLs on the exec Settings page, then click Activate
3. After activation, the node automatically connects to the dedicated Gateway and shows online status
4. Cloud AI Agents can now dispatch local execution tasks through this node

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

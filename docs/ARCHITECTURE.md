# ClawMate Architecture

## Overview

ClawMate is a desktop runtime composed of three layers:

1. React UI (`src/`) for user interaction, status display, and local state management.
2. Rust/Tauri core (`src-tauri/src/`) for privileged commands, auth HTTP calls, gateway WebSocket handling, and native desktop integration.
3. Node sidecar (`sidecar/src/`) for task execution modules invoked through IPC-style messaging.

## Window Appearance

The main window uses the Windows 11 **Mica** material effect (`windowEffects: ["mica"]` in `tauri.conf.json`), with `transparent: true`. This makes the sidebar background automatically inherit the system accent color blended with the desktop wallpaper, matching the native title bar appearance.

- No custom accent color reading is needed; the OS compositor handles blending.
- The sidebar (`Sidebar.tsx`) uses `bg-transparent` to expose the Mica surface.
- The main content area retains a solid `bg-white` background for readability.
- On non-Windows platforms, the transparent background gracefully falls back to the default window color.

## Runtime Layers

### React UI Layer

- Entry: `src/main.tsx`
- Root router: `src/App.tsx`
- Layout shell: `src/components/layout/AppLayout.tsx`
- Primary responsibilities:
  - Display connection status, activity, capabilities, and settings pages
  - Manage local runtime state through Zustand stores
  - Call Tauri commands via `invoke`
  - Subscribe to Tauri events via `listen` (wrapped by `useTauriEvent`)

### Rust/Tauri Core Layer

- Entry: `src-tauri/src/main.rs`
- Registered commands:
  - `config::get_config`
  - `config::save_config`
  - `auth_client::check_auth`
  - `ws_client::connect_gateway`
  - `ws_client::disconnect_gateway`
  - `open_cloud_console`
- Primary responsibilities:
  - Persistent config access through `tauri-plugin-store`
  - HTTP auth verification using `reqwest`
  - Gateway WebSocket client using `tokio-tungstenite`
  - Emitting connection/task events to frontend
  - System tray integration and cloud-console window lifecycle

### Node Sidecar Layer

- Entry: `sidecar/src/index.ts`
- Modules:
  - `sidecar/src/modules/browser.ts`
  - `sidecar/src/modules/system.ts`
  - `sidecar/src/modules/vision.ts`
- Primary responsibilities:
  - Receive JSON line messages from stdin
  - Execute task handlers by task type
  - Return JSON line results through stdout
  - Enforce per-task timeout via `Promise.race`

## Frontend Route Map

- `/` → `DashboardPage` — 任务统计、Gateway 状态、模型/Agent/技能数量概览
- `/chat` → `ChatPage` — 多 Agent 会话列表与流式 AI 对话
- `/models` → `ModelsPage` — Gateway 已配置模型列表（只读）
- `/skills` → `SkillsPage` — Gateway 技能状态查看与依赖安装
- `/activity` → `ActivityPage` — 实时任务执行日志
- `/channel` → `ChannelPage` — 渠道授权管理
- `/settings` → `SettingsPage` — 连接模式选择与配置

All routes are nested under `AppLayout`, which provides the persistent sidebar shell.

## Operator RPC Layer

ClawMate 通过 `operator_client.rs` 维护一条 operator 角色的 WebSocket 长连接到 Gateway，用于管理操作和数据查询。前端通过 `useOperatorConnection` hook 调用 `opCall(method, params)` 与 Gateway 交互。

### 连接生命周期

- Node WebSocket 上线（`ws:connected`）→ 自动触发 operator 连接
- Node 断开 → operator 同步断开
- 状态存储在 `operator.store.ts`：`idle | connecting | connected | error`

### 常用 RPC 方法

| 方法 | 权限 | 说明 |
|------|------|------|
| `models.list` | `operator.read` | 获取已配置模型列表 |
| `agents.list` | `operator.read` | 获取 Agent 列表 |
| `skills.status` | `operator.read` | 获取技能状态列表 |
| `sessions.list` | `operator.read` | 获取会话列表 |
| `chat.history` | `operator.admin` | 获取会话历史消息 |
| `chat.send` | `operator.write` | 发送消息 |
| `chat.abort` | `operator.write` | 中止生成 |
| `sessions.reset` | `operator.admin` | 重置会话 |
| `sessions.delete` | `operator.admin` | 删除会话 |
| `skills.install` | `operator.admin` | 安装技能依赖 |
| `system-presence` | — | Gateway 版本信息 |

### 流式事件

Gateway 通过 `ws:gateway_event` 事件向前端推送实时消息，Chat 流式输出的事件格式：

```
event: "chat"
payload: {
  state: "delta"   // 增量文字片段
         "final"   // 生成完成
         "error"   // 生成出错
  sessionKey: string
  runId: string
  text?: string    // delta 时的增量内容
}
```

Session key 格式：`agent:{agentId}:{rest}`，例如 `agent:main:direct:user123`，通过解析可得到关联的 agentId。

### Dashboard 统计数据来源

| 统计项 | RPC 方法 | 字段 |
|--------|---------|------|
| 已配置模型数 | `models.list` | `payload.models.length` |
| Agent 数 | `agents.list` | `payload.agents.length` |
| 可用技能数 | `skills.status` | `payload.skills.filter(s => s.eligible && !s.disabled).length` |
| Gateway 版本 | `system-presence` | `payload[].version` |

## Store Ownership

### `config` store (`src/store/config.store.ts`)

- Persisted fields (via `zustand/persist` → localStorage):
  - `licenseKey`: the user's license key string
  - `expiryDate`: cached expiry from last successful verify
- In-memory only (not persisted, cleared on session end):
  - `runtimeConfig` (`NodeRuntimeConfig`): `gatewayUrl`, `gatewayWebUI`, `gatewayToken`, `agentId`, `deviceName`, `licenseId`
  - `userProfile` (`UserProfile`): `licenseStatus`, `expiryDate`
- Also owns:
  - `capabilities` flags (`browser`, `system`, `vision`)
  - `approvalRules` (`always`, `never`, `sensitive_only`)
  - `licenseId` (in-memory session meta)
- Provides mutators: `setLicenseKey`, `setRuntimeConfig`, `setUserProfile`, `setSessionMeta`, `clearSession`, `toggleCapability`, `setApprovalRule`.

### `connection` store (`src/store/connection.store.ts`)

- Owns:
  - Connection status state machine (`idle`, `auth_checking`, `connecting`, `online`, etc.)
  - Error message text
  - `onlineAt` timestamp for uptime display

### `tasks` store (`src/store/tasks.store.ts`)

- Owns:
  - Activity logs list
  - Pending approvals queue
- Provides:
  - Log append (capped history)
  - Approval queue add/remove
  - Derived task stats (`total`, `success`, `error`, `pending`)

## Command and Event Inventory

### Tauri Commands (frontend -> Rust)

- `get_config`: read persisted node config from Tauri store.
- `save_config`: write node config to Tauri store.
- `check_auth`: call remote auth endpoint with `{ token, machine_id }`.
- `connect_gateway`: connect to gateway WebSocket and start event emission.
- `disconnect_gateway`: close active WebSocket connection.
- `open_cloud_console`: open/focus the cloud console external window.
- `get_device_identity`: load or generate the local ed25519 device key pair.
- `local_connect`: discover local openclaw service, pair device via `~/.openclaw/devices/paired.json`, optionally restart service, and return gateway connection params.
- `install_update`: check for and apply an available app update via `tauri-plugin-updater`.

## Local Connection Mode

The Settings page supports a second connection mode — **Local OpenClaw** — for users running openclaw on the same machine (local install only; containers are not supported for automatic restart).

### Flow (`local_connect` command, `src-tauri/src/local_connect.rs`)

1. **Workspace discovery**: locates `~/.openclaw/` and reads `openclaw.json` for the configured gateway port (default `18789`).
2. **Port scan**: TCP-probes `127.0.0.1:{port}` through `{port+10}` to find the first live gateway.
3. **Device identity**: loads or generates the local ed25519 key pair via `device_identity`.
4. **Pairing**: reads `devices/paired.json`; if the current `device_id` already has a `node` token, reuses it. Otherwise writes a new entry with a freshly generated 32-byte hex token.
5. **Service restart** (only when a new entry was written): executes `openclaw daemon restart`. Failure (e.g. container install, command not found) is logged and does not abort the flow.
6. **Health wait**: polls the port for up to 15 seconds after restart before proceeding.
7. Returns `{ gateway_url, gateway_web_ui, token, agent_id, device_name, restart_log }` to frontend.

The frontend hook `useLocalConnection` (`src/hooks/useLocalConnection.ts`) drives the phase state machine and feeds timestamped log lines to `LocalConnectPanel` (`src/components/features/settings/LocalConnectPanel.tsx`).

### Tauri Events (Rust -> frontend)

- `ws:connected`: emitted after WebSocket connection succeeds.
- `ws:disconnected`: emitted when the socket closes.
- `ws:error`: emitted on socket/connect failures with error text.
- `ws:task`: emitted when a text message is parsed into `WsTask`.

## Source Tree Ownership Boundaries

- `src/` owns UI rendering and client state only.
- `src-tauri/src/` owns native capabilities, network/auth connections, and OS integration.
- `sidecar/src/` owns task execution routines and timeout-wrapped module execution.
- `docs/` owns architecture and flow documentation for contributor onboarding and maintenance.

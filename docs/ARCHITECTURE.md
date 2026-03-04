# OpenClaw Node Architecture

## Overview

OpenClaw Node is a desktop runtime composed of three layers:

1. React UI (`src/`) for user interaction, status display, and local state management.
2. Rust/Tauri core (`src-tauri/src/`) for privileged commands, auth HTTP calls, gateway WebSocket handling, and native desktop integration.
3. Node sidecar (`sidecar/src/`) for task execution modules invoked through IPC-style messaging.

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

- `/` -> `DashboardPage`
- `/activity` -> `ActivityPage`
- `/capabilities` -> `CapabilitiesPage`
- `/analytics` -> `AnalyticsPage`
- `/settings` -> `SettingsPage`

All routes are nested under `AppLayout`, which provides the persistent sidebar shell.

## Store Ownership

### `config` store (`src/store/config.store.ts`)

- Owns:
  - `config` (`token`, `machine_id`, `auth_endpoint`, `gateway_endpoint`, `cloud_console_url`)
  - `capabilities` flags (`browser`, `system`, `vision`)
  - `approvalRules` (`always`, `never`, `sensitive_only`)
- Provides mutators for each config field and rule/capability updates.

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
- `disconnect_gateway`: exposed command endpoint for disconnect flow.
- `open_cloud_console`: open/focus the cloud console external window.

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

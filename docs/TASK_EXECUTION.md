# OpenClaw Task Execution Model

## Overview

Task execution in OpenClaw spans three contracts:

1. Frontend task/state contracts (`src/types/index.ts`)
2. Gateway task payload contract in Rust (`src-tauri/src/ws_client.rs`)
3. Sidecar execution contract (`sidecar/src/types.ts`)

## Task Schemas

## `Task` (frontend)

Source: `src/types/index.ts`

```ts
interface Task {
  task_id: string
  type: 'browser' | 'system' | 'vision'
  payload: Record<string, unknown>
  require_approval: boolean
  timeout_ms: number
}
```

Used by pending approval queue and task-oriented UI logic.

## `WsTask` (Rust gateway payload)

Source: `src-tauri/src/ws_client.rs`

- `task_id: String`
- `type: String` (serialized as `r#type` in Rust)
- `payload: serde_json::Value`
- `require_approval: bool`
- `timeout_ms: u64`

When a WebSocket text message matches this schema, Rust emits `ws:task` to frontend.

## `SidecarTask` and `SidecarResult` (sidecar IPC)

Source: `sidecar/src/types.ts`

`SidecarTask`:

- `task_id`
- `type` (`browser` | `system` | `vision`)
- `payload`
- `timeout_ms`

`SidecarResult`:

- `task_id`
- `status` (`success` | `error` | `timeout`)
- optional `result`
- optional `error`
- `logs: string[]`

## Approval Rules and Pending Model

Frontend state source: `src/store/config.store.ts` and `src/store/tasks.store.ts`.

Approval mode values:

- `always`
- `never`
- `sensitive_only`

State model:

- `approvalRules` are tracked per task type (`browser`, `system`, `vision`).
- `pendingApprovals` holds queued items with:
  - `task`
  - `resolve(approved: boolean)`

Dashboard UI reads this queue and exposes allow/reject actions.

## Sidecar IPC Protocol

Source: `sidecar/src/index.ts`

Transport:

- Input: stdin, UTF-8, newline-delimited JSON
- Output: stdout, newline-delimited JSON

Inbound messages (`IpcMessage`):

- `{"type":"ping"}`
- `{"type":"execute","data":SidecarTask}`

Outbound messages:

- `{"type":"pong"}`
- `{"type":"result","data":SidecarResult}`

Execution behavior:

- Sidecar routes `execute` by `task.type`.
- Each task is timeout-wrapped with `Promise.race`.
- Exceptions are converted to `status: "error"` results.

## Module Behavior (Current)

Current module implementations:

- `browser` (`sidecar/src/modules/browser.ts`)
- `system` (`sidecar/src/modules/system.ts`)
- `vision` (`sidecar/src/modules/vision.ts`)

Each module currently:

- Receives `SidecarTask`
- Appends a module-tagged log line including payload
- Returns `status: "success"` with `result: null`

## Activity Log and Stats Model

Frontend source: `src/types/index.ts` and `src/store/tasks.store.ts`.

`ActivityLog` fields:

- `id`
- `timestamp`
- `task_id`
- `level` (`success`, `error`, `warning`, `info`, `pending`)
- `title`
- `description`
- `tags`

Stats derivation (`getStats` in tasks store):

- `total`: log count
- `success`: count of `level === "success"`
- `error`: count of `level === "error"`
- `pending`: count of `level === "pending"`

Log retention:

- New logs are prepended.
- History is capped to the most recent 500 entries.

## Related Files

- `src/types/index.ts`
- `src/store/config.store.ts`
- `src/store/tasks.store.ts`
- `src/pages/DashboardPage.tsx`
- `src/pages/ActivityPage.tsx`
- `src/components/features/activity/ActivityItem.tsx`
- `src-tauri/src/ws_client.rs`
- `sidecar/src/types.ts`
- `sidecar/src/index.ts`
- `sidecar/src/modules/browser.ts`
- `sidecar/src/modules/system.ts`
- `sidecar/src/modules/vision.ts`

# OpenClaw Node Connection Flow

## Overview

This document describes how the desktop node is configured, authenticated, connected to the gateway, and synchronized with frontend connection state.

## Node Configuration Fields

Frontend config state (`src/store/config.store.ts`) tracks:

- `token`: node credential string used by auth and gateway.
- `machine_id`: local machine identifier field in frontend state.
- `auth_endpoint`: HTTP endpoint used by `check_auth`.
- `gateway_endpoint`: WebSocket endpoint used by `connect_gateway`.
- `cloud_console_url`: URL opened by `open_cloud_console`.

Rust persistent config (`src-tauri/src/config.rs`) stores:

- `token`
- `auth_endpoint`
- `gateway_endpoint`
- `cloud_console_url`

Storage backend: `tauri-plugin-store`, store file `config.json`, key `node_config`.

## Auth Contract (`check_auth`)

Command source: `src-tauri/src/auth_client.rs`

### Request

`POST {auth_endpoint}` with JSON body:

```json
{
  "token": "string",
  "machine_id": "string"
}
```

### Response

Expected JSON payload:

```json
{
  "allowed": true,
  "message": "optional string"
}
```

Frontend behavior in `useNodeConnection`:

- If `allowed === false`: set status to `unauthorized` and surface message.
- If `allowed === true`: proceed to gateway connection.

## Machine ID Generation

Frontend helper in `src/hooks/useNodeConnection.ts`:

- Reads `machine_id` from browser `localStorage`.
- If missing, generates UUID with `crypto.randomUUID()`.
- Persists generated ID back to `localStorage`.
- Sends this value in `check_auth` payload.

## Connection Sequence

Implemented in `src/hooks/useNodeConnection.ts`:

1. Validate required config fields (`token`, `auth_endpoint`, `gateway_endpoint`).
2. Set frontend status to `auth_checking`.
3. Invoke `check_auth`.
4. On success (`allowed: true`), set status to `connecting` and invoke `connect_gateway`.
5. React to Rust-emitted events:
   - `ws:connected` -> status `online`
   - `ws:disconnected` -> status `idle`
   - `ws:error` -> set error and status `error`

## WebSocket Event Emission

Rust gateway client source: `src-tauri/src/ws_client.rs`

- Connect URL format: `{gateway_url}?token={token}`
- On successful connect: emit `ws:connected`.
- For text messages:
  - Parse JSON into `WsTask`
  - Emit `ws:task` with parsed payload
- On close: emit `ws:disconnected`.
- On connection/read errors: emit `ws:error` with message.

## Cloud Console Window Flow (`open_cloud_console`)

Command source: `src-tauri/src/main.rs`

Flow:

1. Frontend invokes `open_cloud_console` with URL from config store.
2. Rust checks for existing window labeled `cloud-console`.
3. If present: show and focus the existing window.
4. If absent: create a new external `WebviewWindow` with title `OpenClaw Cloud Console`.

Frontend trigger source: `src/components/layout/Sidebar.tsx`.

## Related Files

- `src/hooks/useNodeConnection.ts`
- `src/hooks/useTauri.ts`
- `src/store/config.store.ts`
- `src/store/connection.store.ts`
- `src-tauri/src/auth_client.rs`
- `src-tauri/src/ws_client.rs`
- `src-tauri/src/config.rs`
- `src-tauri/src/main.rs`

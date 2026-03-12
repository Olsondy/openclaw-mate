# ClawMate Connection Flow

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

## Mode Switching and Profile Restore

Mode-switch and reconnect behavior is coordinated by `src/pages/SettingsPage.tsx`
plus profile persistence commands in `src-tauri/src/profile_store.rs`.

- Profile storage location:
  - `~/.clatemate/profiles/license.json`
  - `~/.clatemate/profiles/local.json`
- Commands used:
  - `get_license_profile` / `save_license_profile`
  - `get_local_profile` / `save_local_profile`

Current flow:

1. Settings page loads cached tenant/direct profiles on mount.
2. If user switches mode while online, app disconnects current gateway session first.
3. Target mode dialog opens with fields prefilled from cached profile.
4. User can trigger one-click restore:
   - Tenant restore: reuses cached license key and calls `verifyAndConnect(licenseKey)`.
   - Direct restore:
     - Loopback endpoint (`127.0.0.1` / `localhost`) -> local direct connect.
     - Non-loopback endpoint -> direct cloud connect with cached address/token.

This keeps tenant/direct flows symmetric and allows reconnect without re-entering
credentials each time.

## Startup Auto Reconnect

Startup behavior is now gated by historical connection success:

- `hasConnectedOnce` (persisted in frontend config store) indicates whether the
  user has ever completed a successful gateway connection.
- If `hasConnectedOnce === false`, app shows the welcome modal on startup.
- If `hasConnectedOnce === true`, app skips welcome and attempts auto reconnect
  based on `connectionMode`:
  - `tenant`: restore license key from profile and call `verifyAndConnect`.
  - `direct`: restore local/cloud direct profile and reconnect accordingly.

During auto reconnect the app renders a blocking loading overlay to make the
startup state explicit.

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
- `src/pages/SettingsPage.tsx`
- `src-tauri/src/auth_client.rs`
- `src-tauri/src/ws_client.rs`
- `src-tauri/src/config.rs`
- `src-tauri/src/profile_store.rs`
- `src-tauri/src/main.rs`

## Project Overview

OpenClaw Node is a desktop execution client built with React and Tauri.
It runs as a local node process, authenticates against a remote auth service, connects to a gateway over WebSocket, and executes delegated task modules through a sidecar runtime.
The main code split is:

- `src/` for the React UI and state
- `src-tauri/` for the Rust/Tauri command and event layer
- `sidecar/` for task execution modules
- `docs/` for architecture and workflow documentation

## Key Technologies & Stack

- React 18 + TypeScript
- Vite
- React Router DOM v6
- Zustand
- Tailwind CSS
- Tauri v2
- Rust (`reqwest`, `tokio`, `tokio-tungstenite`)
- Node.js sidecar (`TypeScript`, `Playwright`)
- Vitest + Testing Library

## Development Commands

- Install root dependencies: `npm install`
- Install sidecar dependencies: `cd sidecar && npm install`
- Start frontend dev server: `npm run dev`
- Start desktop app in dev mode: `npm run tauri:dev`
- Run lint: `npm run lint`
- Run web build pre-check: `npm run check` / `npm run check:web`
- Run test pre-check: `npm run check:test`
- Run sidecar pre-check: `npm run check:sidecar`
- Run full pre-checks: `npm run check:all`
- Run tests: `npm test`
- Run web build/type check: `npm run build`
- Build desktop package: `npm run tauri:build`
- Build sidecar TypeScript output: `cd sidecar && npm run build`

## Code Standards

### Current Repo Baseline (Overrides)

If any old example conflicts with the current repository implementation, this section takes precedence.

- Runtime architecture is React + Tauri desktop, with a Rust core and a Node sidecar.
- Routing is implemented with `react-router-dom` in `src/App.tsx`.
- Desktop-native capabilities are exposed via Tauri commands in `src-tauri/src/` and consumed from frontend hooks.
- Task execution modules live in `sidecar/src/modules/`.
- Shared frontend task/state contracts are defined in `src/types/index.ts`.

### Agent Interaction Protocol

Use these rules across IDE agents when executing tasks in this repository:

1. Keep responses concise and task-focused.
2. Prefer patch-level or changed-block outputs over full-file rewrites when presenting code.
3. Explain complex reasoning in Chinese when needed, while keeping code identifiers in English.
4. For simple UI/content fixes, skip over-formal reasoning blocks and focus on the edit.

### Documentation Updates

**CRITICAL**: Always update related documentation files after making code changes:

- After route/layout/store architecture changes -> Update [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- After token/auth/gateway/WebSocket/command-event flow changes -> Update [docs/NODE_CONNECTION.md](docs/NODE_CONNECTION.md)
- After task schema/approval/sidecar/activity flow changes -> Update [docs/TASK_EXECUTION.md](docs/TASK_EXECUTION.md)

Documentation should reflect the actual implementation, not intended behavior.

### Formatting & Linting

- Lint: `npm run lint`
- Web build pre-check: `npm run check` / `npm run check:web`
- Test pre-check: `npm run check:test`
- Sidecar pre-check: `npm run check:sidecar`
- Full pre-checks: `npm run check:all`
- Test suite: `npm test`
- Optional build + type check: `npm run build`
- Sidecar TypeScript build check: `cd sidecar && npm run build`
- End-to-end runtime check (manual): `npm run tauri:dev`

### API & Frontend Guardrails

- Use `invoke` from `@tauri-apps/api/core` for privileged operations.
- Use event listeners (or shared wrappers) for Tauri event channels.
- Keep `invoke` request/response payloads explicitly typed in frontend code.
- Do not call gateway or privileged system logic directly from React components.
- Keep shared task/state contracts in `src/types/index.ts` and sidecar IPC contracts in `sidecar/src/types.ts`.
- Keep UI state transitions inside Zustand stores under `src/store/`.

### UI Component Pattern

- Reusable primitives live in `src/components/ui/` (`Button`, `Card`, `Badge`, `Switch`).
- Page shell components live in `src/components/layout/`.
- Feature-specific UI lives in `src/components/features/`.
- Use Tailwind tokens defined in `tailwind.config.ts` and `src/styles/tokens.css`.

### Adding New Components

1. Add reusable UI primitives under `src/components/ui/`.
2. Add feature-specific components under `src/components/features/<feature>/`.
3. Export new UI primitives from `src/components/ui/index.ts`.
4. Add focused tests for interactive logic and rendering behavior.
5. Keep styling aligned with existing token-based Tailwind classes.

## Project Structure

```text
easy-openclaw/
  ├── .husky/                          # Git hooks managed by Husky
  │   └── pre-commit
  ├── src/                              # React frontend
  │   ├── App.tsx
  │   ├── main.tsx
  │   ├── vite-env.d.ts
  │   ├── components/
  │   │   ├── features/
  │   │   │   └── activity/
  │   │   │      ├── ActivityItem.tsx
  │   │   │      └── ActivityItem.test.tsx
  │   │   ├── layout/
  │   │   │   ├── AppLayout.tsx
  │   │   │   ├── Sidebar.tsx
  │   │   │   └── TopBar.tsx
  │   │   └── ui/
  │   │      ├── Badge.tsx
  │   │      ├── Button.tsx
  │   │      ├── Card.tsx
  │   │      ├── Switch.tsx
  │   │      ├── Switch.test.tsx
  │   │      └── index.ts
  │   ├── hooks/
  │   │   ├── useNodeConnection.ts
  │   │   └── useTauri.ts
  │   ├── pages/
  │   │   ├── ActivityPage.tsx
  │   │   ├── AnalyticsPage.tsx
  │   │   ├── CapabilitiesPage.tsx
  │   │   ├── DashboardPage.tsx
  │   │   └── SettingsPage.tsx
  │   ├── store/
  │   │   ├── config.store.ts
  │   │   ├── config.store.test.ts
  │   │   ├── connection.store.ts
  │   │   ├── tasks.store.ts
  │   │   └── index.ts
  │   ├── styles/
  │   │   └── tokens.css
  │   ├── test/
  │   │   └── setup.ts
  │   └── types/
  │      ├── index.ts
  │      └── index.test.ts
  ├── src-tauri/                        # Rust + Tauri core
  │   ├── Cargo.toml
  │   ├── Cargo.lock
  │   ├── build.rs
  │   ├── tauri.conf.json
  │   ├── capabilities/
  │   │   └── default.json
  │   ├── src/
  │   │   ├── auth_client.rs
  │   │   ├── config.rs
  │   │   ├── main.rs
  │   │   ├── tray.rs
  │   │   └── ws_client.rs
  │   └── icons/                        # App icon assets (omitted for brevity)
  ├── sidecar/                          # Node.js execution sidecar
  │   ├── package.json
  │   ├── package-lock.json
  │   ├── tsconfig.json
  │   └── src/
  │      ├── index.ts
  │      ├── types.ts
  │      └── modules/
  │         ├── browser.ts
  │         ├── system.ts
  │         └── vision.ts
  ├── docs/                             # Architecture and planning docs
  │   ├── ARCHITECTURE.md
  │   ├── NODE_CONNECTION.md
  │   ├── TASK_EXECUTION.md
  │   ├── logo.svg
  │   └── plans/
  │      ├── 2026-03-04-openclaw-node-design.md
  │      └── 2026-03-04-openclaw-node-implementation.md
  ├── dist/                             # Frontend build output
  ├── node_modules/                     # Root dependencies
  ├── package.json
  ├── package-lock.json
  ├── biome.json
  ├── tailwind.config.ts
  ├── postcss.config.js
  ├── tsconfig.json
  ├── tsconfig.node.json
  ├── vite.config.ts
  ├── README.md
  └── AGENTS.md
```

## Domain-Specific Documentation

The project has focused documentation for core domains. **ALWAYS read the relevant documentation files before working on related features.**

### ALWAYS Read These Files Before:

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**
  - When changing frontend structure, routes, stores, layout boundaries, or command/event ownership
  - Covers: runtime layers, route map, state ownership, command/event inventory, source boundaries

- **[docs/NODE_CONNECTION.md](docs/NODE_CONNECTION.md)**
  - When changing token flow, auth checks, gateway connection lifecycle, machine identity behavior, or cloud console window flow
  - Covers: node config fields, auth contract, connection sequence, event lifecycle

### Read When Relevant:

- **[docs/TASK_EXECUTION.md](docs/TASK_EXECUTION.md)**
  - When changing task contracts, approval handling, sidecar IPC, execution modules, or activity aggregation
  - Covers: `Task`/`WsTask`/`SidecarTask` models, approval rules, IPC messages, module execution outputs, stats derivation

- **[docs/plans/](docs/plans)**
  - When aligning implementation choices with existing design and execution plans
  - Covers: archived architecture decisions and implementation sequencing

## Quick Reference

### Authentication Usage

```typescript
import { useNodeConnection } from './hooks/useNodeConnection'
import { useConfigStore } from './store'

const { connect } = useNodeConnection()
const { setToken, setAuthEndpoint, setGatewayEndpoint } = useConfigStore()

setToken('node-token')
setAuthEndpoint('https://auth.example.com/node-connect')
setGatewayEndpoint('wss://gateway.example.com')

await connect()
```

### Navigation with i18n

```typescript
// This heading is kept for compatibility.
// Current implementation uses direct React Router navigation (no locale routing layer).
import { NavLink, useNavigate } from 'react-router-dom'

function Menu() {
  return <NavLink to="/settings">Settings</NavLink>
}

function JumpToActivity() {
  const navigate = useNavigate()
  return <button onClick={() => navigate('/activity')}>Open Activity</button>
}
```

### Translations

```typescript
// Current implementation has no translation framework.
// Keep user-facing labels centralized in maps/constants for consistency.
const statusLabel: Record<string, string> = {
  online: 'Online',
  connecting: 'Connecting',
  auth_checking: 'Auth checking',
  unauthorized: 'Unauthorized',
  error: 'Error',
}
```

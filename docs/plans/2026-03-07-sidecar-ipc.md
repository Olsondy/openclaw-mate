# Sidecar IPC Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the Rust core to the Node.js sidecar via stdin/stdout JSON line IPC, enabling `browser.*` and `vision.*` commands dispatched by Gateway to be executed by the sidecar.

**Architecture:** A `SidecarManager` struct in Rust spawns the Node.js sidecar process and holds its stdin/stdout pipes. Tasks are sent as JSON lines to stdin and matched back to callers via a `task_id → oneshot::Sender` pending map. `ws_client.rs` routes `browser.*` and `vision.*` commands to the manager instead of returning "unsupported".

**Tech Stack:** Rust (`tokio`, `serde_json`, `tokio::process`), TypeScript sidecar (`playwright`, `jest`), Tauri app state (`app.manage`)

---

## Current State (read before starting)

- `sidecar/src/index.ts` — IPC entry, routes by `task.type`, already handles ping/pong
- `sidecar/src/types.ts` — `SidecarTask`, `SidecarResult`, `IpcMessage` types
- `sidecar/src/modules/browser.ts` — stub, returns `null`
- `sidecar/src/modules/vision.ts` — stub, returns `null`
- `sidecar/src/modules/system.ts` — stub, returns `null`
- `src-tauri/src/ws_client.rs` — `execute_command()` only handles `system.run`, returns error for everything else
- `src-tauri/src/main.rs` — plugin registration, setup fn

The sidecar IPC protocol (stdin/stdout JSON lines) is already fully specified in `sidecar/src/types.ts`. Do not change the protocol.

---

## Task 1: Verify sidecar builds and IPC protocol works

**Files:**
- Read: `sidecar/src/index.ts`, `sidecar/src/types.ts`
- Run: `sidecar/`

**Step 1: Build the sidecar**

```bash
cd openclaw-exec/sidecar && npm install && npm run build
```

Expected: `sidecar/dist/index.js` created, no TypeScript errors.

**Step 2: Smoke test the IPC manually**

```bash
echo '{"type":"ping"}' | node sidecar/dist/index.js
```

Expected output: `{"type":"pong"}`

**Step 3: Commit**

```bash
git add sidecar/dist/
git commit -m "chore: add compiled sidecar dist"
```

---

## Task 2: Create `sidecar.rs` — SidecarManager

**Files:**
- Create: `openclaw-exec/src-tauri/src/sidecar.rs`

The manager spawns the Node.js process, writes JSON lines to stdin, reads JSON lines from stdout, and matches responses to callers using a `task_id → oneshot::Sender` map.

**Step 1: Write the failing test first**

At the bottom of the new `sidecar.rs` file, add:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_ping() {
        let mgr = SidecarManager::spawn("node", &["../sidecar/dist/index.js"])
            .await
            .expect("sidecar spawn failed");
        mgr.ping().await.expect("ping failed");
    }

    #[tokio::test]
    async fn test_execute_system_run() {
        let mgr = SidecarManager::spawn("node", &["../sidecar/dist/index.js"])
            .await
            .expect("sidecar spawn failed");
        let task = SidecarTask {
            task_id: "t1".to_string(),
            task_type: "system".to_string(),
            payload: serde_json::json!({ "command": "echo hello" }),
            timeout_ms: 5000,
        };
        let result = mgr.execute(task).await.expect("execute failed");
        assert_eq!(result.status, "success");
    }
}
```

**Step 2: Run to confirm it fails**

```bash
cd openclaw-exec/src-tauri && cargo test sidecar
```

Expected: compile error — `SidecarManager` not defined.

**Step 3: Implement `sidecar.rs`**

```rust
use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{oneshot, Mutex};

// ── Types matching sidecar/src/types.ts ──────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct SidecarTask {
    pub task_id: String,
    #[serde(rename = "type")]
    pub task_type: String,
    pub payload: serde_json::Value,
    pub timeout_ms: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SidecarResult {
    pub task_id: String,
    pub status: String,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub logs: Vec<String>,
}

#[derive(Debug, Serialize)]
struct IpcMessage {
    #[serde(rename = "type")]
    msg_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<SidecarTask>,
}

#[derive(Debug, Deserialize)]
struct IpcResponse {
    #[serde(rename = "type")]
    msg_type: String,
    data: Option<SidecarResult>,
}

// ── SidecarManager ────────────────────────────────────────────────────

type PendingMap = Arc<Mutex<HashMap<String, oneshot::Sender<SidecarResult>>>>;

pub struct SidecarManager {
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
    pending: PendingMap,
}

impl SidecarManager {
    pub async fn spawn(program: &str, args: &[&str]) -> Result<Self, String> {
        let mut child = Command::new(program)
            .args(args)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit())
            .spawn()
            .map_err(|e| format!("sidecar spawn failed: {}", e))?;

        let stdin = Arc::new(Mutex::new(
            child.stdin.take().ok_or("no stdin")?,
        ));
        let stdout = child.stdout.take().ok_or("no stdout")?;
        let pending: PendingMap = Arc::new(Mutex::new(HashMap::new()));

        let pending_reader = pending.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                if let Ok(resp) = serde_json::from_str::<IpcResponse>(&line) {
                    if resp.msg_type == "result" {
                        if let Some(result) = resp.data {
                            let mut map = pending_reader.lock().await;
                            if let Some(tx) = map.remove(&result.task_id) {
                                tx.send(result).ok();
                            }
                        }
                    }
                }
            }
        });

        // keep child alive
        tokio::spawn(async move { child.wait().await });

        Ok(Self { stdin, pending })
    }

    pub async fn execute(&self, task: SidecarTask) -> Result<SidecarResult, String> {
        let (tx, rx) = oneshot::channel();
        self.pending.lock().await.insert(task.task_id.clone(), tx);

        self.write_msg(IpcMessage {
            msg_type: "execute".to_string(),
            data: Some(task),
        })
        .await?;

        rx.await.map_err(|_| "sidecar result channel closed".to_string())
    }

    pub async fn ping(&self) -> Result<(), String> {
        self.write_msg(IpcMessage {
            msg_type: "ping".to_string(),
            data: None,
        })
        .await
    }

    async fn write_msg(&self, msg: IpcMessage) -> Result<(), String> {
        let line = serde_json::to_string(&msg).map_err(|e| e.to_string())? + "\n";
        self.stdin
            .lock()
            .await
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("sidecar write failed: {}", e))
    }
}
```

**Step 4: Run the tests**

```bash
cd openclaw-exec/src-tauri && cargo test sidecar -- --nocapture
```

Expected: both tests pass. If `system.ts` stub returns `success`, `test_execute_system_run` will pass.

**Step 5: Commit**

```bash
git add src-tauri/src/sidecar.rs
git commit -m "feat: add SidecarManager for stdin/stdout IPC with Node sidecar"
```

---

## Task 3: Register SidecarManager in `main.rs`

**Files:**
- Modify: `openclaw-exec/src-tauri/src/main.rs`

Spawn the sidecar at startup and store it as Tauri managed state so `ws_client.rs` can access it.

**Step 1: Add mod and managed state**

In `main.rs`, add after the existing `mod` declarations:

```rust
mod sidecar;
use sidecar::SidecarManager;
```

**Step 2: Spawn in setup and manage state**

Replace the `setup` closure with:

```rust
.setup(|app| {
    tray::setup_tray(app)?;
    if let Err(e) = device_identity::load_or_create_device_identity(app.handle()) {
        eprintln!("[device_identity] init failed: {}", e);
    }

    // Spawn sidecar
    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        match SidecarManager::spawn("node", &["sidecar/dist/index.js"]).await {
            Ok(mgr) => {
                handle.manage(Arc::new(mgr));
                eprintln!("[sidecar] ready");
            }
            Err(e) => eprintln!("[sidecar] failed to start: {}", e),
        }
        // update check
        use tauri_plugin_updater::UpdaterExt;
        if let Ok(updater) = handle.updater() {
            if let Ok(Some(update)) = updater.check().await {
                handle.emit("update:available", &update.version).ok();
            }
        }
    });

    Ok(())
})
```

Add `use std::sync::Arc;` at the top of `main.rs` if not already present.

**Step 3: Build to confirm compiles**

```bash
cd openclaw-exec && npm run build
```

Expected: no errors. (Tauri full build not required here, just TS + check.)

```bash
cd openclaw-exec/src-tauri && cargo check
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/src/sidecar.rs
git commit -m "feat: spawn SidecarManager on app startup, manage in Tauri state"
```

---

## Task 4: Route `browser.*` and `vision.*` to sidecar in `ws_client.rs`

**Files:**
- Modify: `openclaw-exec/src-tauri/src/ws_client.rs`

**Step 1: Update `execute_command` signature to accept AppHandle**

In `ws_client.rs`, find:

```rust
async fn execute_command(command: &str, args: &serde_json::Value) -> TaskResult {
```

Change to:

```rust
async fn execute_command(app: &tauri::AppHandle, command: &str, args: &serde_json::Value) -> TaskResult {
```

Update the call site in `handle_gateway_message` from:

```rust
let result = execute_command(&invoke_params.command, &invoke_params.args).await;
```

To:

```rust
let result = execute_command(&app, &invoke_params.command, &invoke_params.args).await;
```

**Step 2: Add sidecar routing inside `execute_command`**

Replace the entire `execute_command` function body with:

```rust
async fn execute_command(app: &tauri::AppHandle, command: &str, args: &serde_json::Value) -> TaskResult {
    use crate::sidecar::{SidecarManager, SidecarTask};
    use std::sync::Arc;

    let start = std::time::Instant::now();
    let task_type = command.split('.').next().unwrap_or("system");

    // Route browser.* and vision.* to sidecar
    if matches!(task_type, "browser" | "vision") {
        let mgr_state = app.try_state::<Arc<SidecarManager>>();
        match mgr_state {
            Some(mgr) => {
                let task = SidecarTask {
                    task_id: format!("{}_{}", command, std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis()),
                    task_type: task_type.to_string(),
                    payload: args.clone(),
                    timeout_ms: 30000,
                };
                match mgr.execute(task).await {
                    Ok(res) => return TaskResult {
                        task_id: String::new(),
                        success: res.status == "success",
                        stdout: res.result.map(|v| v.to_string()).unwrap_or_default(),
                        stderr: res.error.unwrap_or_default(),
                        exit_code: None,
                        duration_ms: start.elapsed().as_millis() as u64,
                    },
                    Err(e) => return TaskResult {
                        task_id: String::new(),
                        success: false,
                        stdout: String::new(),
                        stderr: format!("sidecar error: {}", e),
                        exit_code: None,
                        duration_ms: start.elapsed().as_millis() as u64,
                    },
                }
            }
            None => return TaskResult {
                task_id: String::new(),
                success: false,
                stdout: String::new(),
                stderr: "sidecar not available".to_string(),
                exit_code: None,
                duration_ms: start.elapsed().as_millis() as u64,
            },
        }
    }

    // system.run — Rust direct execution
    match command {
        "system.run" => {
            // existing implementation stays here unchanged
            let cmd_str = args.get("command")
                .and_then(|c| c.as_str())
                .unwrap_or("");
            let cwd = args.get("cwd").and_then(|c| c.as_str());
            if cmd_str.is_empty() {
                return TaskResult {
                    task_id: String::new(),
                    success: false,
                    stdout: String::new(),
                    stderr: "No command provided".to_string(),
                    exit_code: None,
                    duration_ms: start.elapsed().as_millis() as u64,
                };
            }
            let output = if cfg!(target_os = "windows") {
                let mut cmd = tokio::process::Command::new("cmd");
                cmd.args(["/C", cmd_str]);
                if let Some(dir) = cwd { cmd.current_dir(dir); }
                cmd.output().await
            } else {
                let mut cmd = tokio::process::Command::new("sh");
                cmd.args(["-c", cmd_str]);
                if let Some(dir) = cwd { cmd.current_dir(dir); }
                cmd.output().await
            };
            match output {
                Ok(out) => TaskResult {
                    task_id: String::new(),
                    success: out.status.success(),
                    stdout: String::from_utf8_lossy(&out.stdout).to_string(),
                    stderr: String::from_utf8_lossy(&out.stderr).to_string(),
                    exit_code: out.status.code(),
                    duration_ms: start.elapsed().as_millis() as u64,
                },
                Err(e) => TaskResult {
                    task_id: String::new(),
                    success: false,
                    stdout: String::new(),
                    stderr: format!("Process error: {}", e),
                    exit_code: None,
                    duration_ms: start.elapsed().as_millis() as u64,
                },
            }
        }
        _ => TaskResult {
            task_id: String::new(),
            success: false,
            stdout: String::new(),
            stderr: format!("Unsupported command: {}", command),
            exit_code: None,
            duration_ms: start.elapsed().as_millis() as u64,
        },
    }
}
```

**Step 3: Check compiles**

```bash
cd openclaw-exec/src-tauri && cargo check
```

Expected: no errors.

**Step 4: Commit**

```bash
git add src-tauri/src/ws_client.rs
git commit -m "feat: route browser.* and vision.* commands to sidecar IPC"
```

---

## Task 5: Implement `browser.ts` with Playwright

**Files:**
- Modify: `openclaw-exec/sidecar/src/modules/browser.ts`

Supported commands (via `payload.command`):
- `browser.navigate` — open URL, return `{ title, url }`
- `browser.screenshot` — return base64 PNG of current page
- `browser.click` — click a CSS selector
- `browser.type` — type text into a CSS selector

**Step 1: Write failing tests**

Create `openclaw-exec/sidecar/src/modules/browser.test.ts`:

```typescript
import { executeBrowser } from './browser'
import type { SidecarTask } from '../types'

const makeTask = (command: string, args: Record<string, unknown>): SidecarTask => ({
  task_id: 'test-1',
  type: 'browser',
  payload: { command, ...args },
  timeout_ms: 30000,
})

describe('browser module', () => {
  afterAll(async () => {
    // ensure playwright browser is closed
    const { closeBrowser } = await import('./browser')
    await closeBrowser()
  })

  it('navigates to a URL and returns title', async () => {
    const result = await executeBrowser(makeTask('browser.navigate', { url: 'https://example.com' }))
    expect(result.status).toBe('success')
    expect(result.result).toHaveProperty('title')
    expect(result.result).toHaveProperty('url')
  }, 30000)

  it('takes a screenshot and returns base64', async () => {
    await executeBrowser(makeTask('browser.navigate', { url: 'https://example.com' }))
    const result = await executeBrowser(makeTask('browser.screenshot', {}))
    expect(result.status).toBe('success')
    expect(typeof result.result).toBe('string')
    expect((result.result as string).length).toBeGreaterThan(100)
  }, 30000)

  it('returns error for unknown command', async () => {
    const result = await executeBrowser(makeTask('browser.unknown', {}))
    expect(result.status).toBe('error')
  }, 10000)
})
```

**Step 2: Run to confirm fails**

```bash
cd openclaw-exec/sidecar && npx jest browser.test.ts
```

Expected: FAIL — `executeBrowser` returns null result, `title` assertion fails.

**Step 3: Implement `browser.ts`**

```typescript
import { chromium, type Browser, type Page } from 'playwright'
import type { SidecarTask, SidecarResult } from '../types'

let browser: Browser | null = null
let page: Page | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: true })
  }
  return browser
}

async function getPage(): Promise<Page> {
  const b = await getBrowser()
  if (!page || page.isClosed()) {
    page = await b.newPage()
  }
  return page
}

export async function closeBrowser(): Promise<void> {
  await browser?.close()
  browser = null
  page = null
}

export async function executeBrowser(task: SidecarTask): Promise<SidecarResult> {
  const logs: string[] = []
  const command = task.payload.command as string

  try {
    const p = await getPage()

    switch (command) {
      case 'browser.navigate': {
        const url = task.payload.url as string
        await p.goto(url, { waitUntil: 'domcontentloaded' })
        const title = await p.title()
        logs.push(`[browser] navigated to ${url}`)
        return { task_id: task.task_id, status: 'success', result: { title, url: p.url() }, logs }
      }

      case 'browser.screenshot': {
        const buffer = await p.screenshot({ type: 'png' })
        const base64 = buffer.toString('base64')
        logs.push('[browser] screenshot taken')
        return { task_id: task.task_id, status: 'success', result: base64, logs }
      }

      case 'browser.click': {
        const selector = task.payload.selector as string
        await p.click(selector)
        logs.push(`[browser] clicked ${selector}`)
        return { task_id: task.task_id, status: 'success', result: null, logs }
      }

      case 'browser.type': {
        const selector = task.payload.selector as string
        const text = task.payload.text as string
        await p.fill(selector, text)
        logs.push(`[browser] typed into ${selector}`)
        return { task_id: task.task_id, status: 'success', result: null, logs }
      }

      default:
        return { task_id: task.task_id, status: 'error', error: `Unknown browser command: ${command}`, logs }
    }
  } catch (e) {
    return { task_id: task.task_id, status: 'error', error: String(e), logs }
  }
}
```

**Step 4: Run tests**

```bash
cd openclaw-exec/sidecar && npx jest browser.test.ts --testTimeout=30000
```

Expected: all pass. If Playwright browsers not installed:

```bash
npx playwright install chromium
```

Then re-run.

**Step 5: Rebuild sidecar**

```bash
cd openclaw-exec/sidecar && npm run build
```

**Step 6: Commit**

```bash
git add sidecar/src/modules/browser.ts sidecar/src/modules/browser.test.ts sidecar/dist/
git commit -m "feat: implement browser module with Playwright (navigate, screenshot, click, type)"
```

---

## Task 6: Implement `vision.ts` — screenshot

**Files:**
- Modify: `openclaw-exec/sidecar/src/modules/vision.ts`

Supported commands:
- `vision.screenshot` — full-screen screenshot, returns base64 PNG

Reuses Playwright (same browser instance via shared getBrowser import) rather than OS-level screenshot tools for cross-platform consistency.

**Step 1: Write failing test**

Create `openclaw-exec/sidecar/src/modules/vision.test.ts`:

```typescript
import { executeVision } from './vision'
import type { SidecarTask } from '../types'

const makeTask = (command: string): SidecarTask => ({
  task_id: 'v-test-1',
  type: 'vision',
  payload: { command },
  timeout_ms: 15000,
})

describe('vision module', () => {
  it('takes a full-page screenshot and returns base64', async () => {
    const result = await executeVision(makeTask('vision.screenshot'))
    expect(result.status).toBe('success')
    expect(typeof result.result).toBe('string')
    expect((result.result as string).length).toBeGreaterThan(100)
  }, 15000)

  it('returns error for unknown command', async () => {
    const result = await executeVision(makeTask('vision.unknown'))
    expect(result.status).toBe('error')
  })
})
```

**Step 2: Run to confirm fails**

```bash
cd openclaw-exec/sidecar && npx jest vision.test.ts
```

Expected: FAIL.

**Step 3: Implement `vision.ts`**

```typescript
import { chromium } from 'playwright'
import type { SidecarTask, SidecarResult } from '../types'

export async function executeVision(task: SidecarTask): Promise<SidecarResult> {
  const logs: string[] = []
  const command = task.payload.command as string

  try {
    switch (command) {
      case 'vision.screenshot': {
        const browser = await chromium.launch({ headless: true })
        const page = await browser.newPage()
        await page.setViewportSize({ width: 1280, height: 800 })
        const buffer = await page.screenshot({ type: 'png', fullPage: true })
        await browser.close()
        const base64 = buffer.toString('base64')
        logs.push('[vision] screenshot captured')
        return { task_id: task.task_id, status: 'success', result: base64, logs }
      }

      default:
        return { task_id: task.task_id, status: 'error', error: `Unknown vision command: ${command}`, logs }
    }
  } catch (e) {
    return { task_id: task.task_id, status: 'error', error: String(e), logs }
  }
}
```

**Step 4: Run tests**

```bash
cd openclaw-exec/sidecar && npx jest vision.test.ts
```

Expected: passes.

**Step 5: Rebuild and commit**

```bash
cd openclaw-exec/sidecar && npm run build
git add sidecar/src/modules/vision.ts sidecar/src/modules/vision.test.ts sidecar/dist/
git commit -m "feat: implement vision module with screenshot capability"
```

---

## Task 7: End-to-end Rust integration test

**Files:**
- Modify: `openclaw-exec/src-tauri/src/sidecar.rs` (add test)

**Step 1: Add browser integration test**

Append to the `#[cfg(test)]` block in `sidecar.rs`:

```rust
#[tokio::test]
async fn test_execute_browser_navigate() {
    let mgr = SidecarManager::spawn("node", &["../sidecar/dist/index.js"])
        .await
        .expect("spawn failed");
    let task = SidecarTask {
        task_id: "b1".to_string(),
        task_type: "browser".to_string(),
        payload: serde_json::json!({
            "command": "browser.navigate",
            "url": "https://example.com"
        }),
        timeout_ms: 30000,
    };
    let result = mgr.execute(task).await.expect("execute failed");
    assert_eq!(result.status, "success");
    let title = result.result.unwrap();
    assert!(title.get("title").is_some());
}
```

**Step 2: Run**

```bash
cd openclaw-exec/src-tauri && cargo test sidecar -- --nocapture
```

Expected: all 3 sidecar tests pass.

**Step 3: Final commit**

```bash
git add src-tauri/src/sidecar.rs
git commit -m "test: add Rust integration test for sidecar browser.navigate"
```

---

## Update README command table

After all tasks pass, update `openclaw-exec/README.md` and `README.zh-CN.md`:

Change:
```
| `browser.navigate` / `browser.click` | 🚧 Planned |
| `vision.screenshot` | 🚧 Planned |
```

To:
```
| `browser.navigate` | ✅ Implemented |
| `browser.screenshot` | ✅ Implemented |
| `browser.click` | ✅ Implemented |
| `browser.type` | ✅ Implemented |
| `vision.screenshot` | ✅ Implemented |
```

```bash
git add README.md README.zh-CN.md
git commit -m "docs: update supported commands table after sidecar IPC implementation"
```

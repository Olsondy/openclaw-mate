# OpenClaw Node 桌面客户端 — 设计文档

**日期：** 2026-03-04
**技术栈：** Tauri v2 + React (Vite/TypeScript) + TailwindCSS
**目标用户：** 普通用户

---

## 一、产品定位

OpenClaw Node 是一个运行在用户本地机器上的 AI 物理执行节点桌面客户端。核心职责：
- 后台常驻，接收远程 Gateway 下发的 AI 任务
- 在本机执行浏览器自动化、系统操作、视觉识别等能力
- 通过用户可配置的审批规则，保障执行安全

---

## 二、整体架构

```
┌──────────────────────────────────────────────────┐
│                  用户界面层                        │
│  React + Vite/TS + TailwindCSS (Material You)    │
│  ├── 系统托盘菜单                                  │
│  ├── 仪表盘窗口（状态、任务历史、日志）              │
│  └── 设置窗口（Token 绑定、能力开关、审批规则）      │
├──────────────────────────────────────────────────┤
│                  Tauri 核心层 (Rust)               │
│  ├── Auth HTTP Client → 启动时验证节点连接权限       │
│  ├── WebSocket Client → 连接远程 Gateway            │
│  ├── 任务调度器 → 接收任务，分发给对应 Sidecar       │
│  ├── 权限审批队列 → 拦截敏感操作，等待用户确认        │
│  └── 配置管理 → 持久化 Token、能力开关、审批规则      │
├──────────────────────────────────────────────────┤
│                  执行引擎层 (Node.js Sidecar)       │
│  ├── 浏览器自动化模块（Playwright）[可开关]           │
│  ├── 系统操作模块（文件、进程、命令执行）[可开关]     │
│  └── 视觉能力模块（截图、OCR）[可开关]               │
└──────────────────────────────────────────────────┘
         ↕ WebSocket
┌──────────────────────────────────────────────────┐
│              远程 Gateway + Auth 服务              │
└──────────────────────────────────────────────────┘
```

---

## 三、UI 设计规范

### 设计语言
- **风格：** Google Material Design 3 (Material You)
- **字体：** Google Sans / Inter
- **圆角：** 卡片 12-16px，按钮 8px
- **颜色：** Material You Token 系统（Primary / Secondary / Surface / Error）
- **阴影：** 极轻微 elevation
- **交互：** Ripple 点击效果，三级按钮（Filled / Outlined / Text）
- **图标：** Material Symbols
- **间距：** 8px 基础网格
- **原型参考：** `demo.png`（时间轴日志风格）

### 界面形态
默认系统托盘运行，点击打开完整仪表盘窗口。

### 托盘状态

| 图标颜色 | 含义 |
|---------|------|
| 🟢 绿色 | 已连接 Gateway，待命中 |
| 🟡 黄色 | 连接中 / 有待审批任务 |
| 🔴 红色 | 未连接 / 错误 / 未授权 |
| ⚫ 灰色 | 已暂停 |

托盘右键菜单：打开控制台 / 暂停·恢复 / 待审批任务(n) / 退出

### 页面结构

```
左侧边栏：
├── 🤖 OpenClaw Node（Logo + 版本）
├── ─────────────────
├── 📊 Dashboard      → 节点状态卡片、实时任务、待审批列表
├── ⚡ Activity       → 时间轴任务日志（All/Errors/Successes/Pending）
├── 🔌 Capabilities   → 执行能力模块开关
├── 📈 Analytics      → 任务统计
├── ─────────────────
├── 🌐 云端控制台      → 打开内嵌 WebView 窗口（加载云端 WebUI）
└── ⚙️  Settings       → Token 绑定、审批规则配置
```

### 审批弹窗
有敏感操作时主动弹出，包含：操作描述、任务来源、拒绝/允许按钮、"同类操作今天不再询问"复选框。

---

## 四、节点启动与认证流程

```
客户端启动
    │
    ▼
HTTP POST /auth/node-connect
{ token: "xxx", machine_id: "hash(CPU+MAC+hostname)" }
    │
    ├── allowed: true  → 建立 WebSocket 连接 Gateway ✅
    └── allowed: false → 托盘红色，Settings 提示"Token 已绑定其他设备"❌
```

**客户端状态机：**
```
[启动] → [Auth 验证中] → [已授权] → [WebSocket 连接中] → [在线待命]
                      ↘ [未授权] → 托盘红色，引导用户检查 Token
```

1 个 Token 绑定 1 台机器的逻辑完全由 Auth 服务控制，客户端只处理返回结果。

---

## 五、任务执行数据流

```
Gateway 下发任务 (WebSocket)
    │
    ▼ Task { task_id, type, payload, require_approval, timeout_ms }
    │
    ├── 能力检查：对应模块是否已启用？
    │     └── 否 → 回报 capability_disabled，结束
    │
    ├── 审批规则检查：此类型是否需要用户确认？
    │     ├── 是 → 推送审批通知到 UI，暂停执行，等待用户操作
    │     │       ├── 用户允许 → 继续
    │     │       └── 用户拒绝 → 回报 rejected，结束
    │     └── 否 → 继续
    │
    ├── 分发给 Node.js Sidecar 执行
    │     └── 实时流式回传日志 → Activity 时间轴追加
    │
    └── 执行结果回报 Gateway { task_id, status, result }
```

---

## 六、核心数据结构

```typescript
interface Task {
  task_id: string
  type: 'browser' | 'system' | 'vision'
  payload: Record<string, unknown>
  require_approval: boolean
  timeout_ms: number
}

interface ActivityLog {
  id: string
  timestamp: Date
  task_id: string
  level: 'success' | 'error' | 'warning' | 'info' | 'pending'
  title: string
  description: string
  tags: string[]
}

interface Capabilities {
  browser: boolean
  system: boolean
  vision: boolean
}

type ApprovalMode = 'always' | 'never' | 'sensitive_only'

interface ApprovalRules {
  browser: ApprovalMode
  system: ApprovalMode
  vision: ApprovalMode
}

interface NodeConfig {
  token: string
  machine_id: string
  auth_endpoint: string
  gateway_endpoint: string
  capabilities: Capabilities
  approval_rules: ApprovalRules
}
```

---

## 七、项目结构

```
easy-openclaw/
├── src-tauri/                    # Rust 核心层
│   ├── src/
│   │   ├── main.rs               # 入口
│   │   ├── ws_client.rs          # WebSocket 连接 Gateway
│   │   ├── auth_client.rs        # HTTP Auth 验证
│   │   ├── task_dispatcher.rs    # 任务调度 + 能力检查
│   │   ├── approval_queue.rs     # 权限审批队列
│   │   ├── config.rs             # 持久化配置
│   │   └── tray.rs               # 系统托盘
│   └── tauri.conf.json
│
├── sidecar/                      # Node.js 执行引擎
│   ├── src/
│   │   ├── index.ts              # IPC 入口
│   │   ├── modules/
│   │   │   ├── browser.ts        # Playwright 浏览器自动化
│   │   │   ├── system.ts         # 文件/进程/命令操作
│   │   │   └── vision.ts         # 截图/OCR
│   │   └── types.ts
│   └── package.json
│
├── src/                          # React 前端
│   ├── components/
│   │   ├── ui/                   # Material You 基础组件
│   │   ├── layout/               # Sidebar、TopBar
│   │   └── features/             # activity / dashboard / capabilities / approval
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── ActivityPage.tsx
│   │   ├── CapabilitiesPage.tsx
│   │   ├── AnalyticsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── store/                    # Zustand 状态管理
│   │   ├── connection.store.ts
│   │   ├── tasks.store.ts
│   │   └── config.store.ts
│   ├── hooks/
│   │   ├── useTauri.ts
│   │   └── useWebSocket.ts
│   └── App.tsx
│
├── docs/plans/
├── demo.png
├── package.json
└── vite.config.ts
```

---

## 八、错误处理

| 场景 | 处理方式 |
|------|---------|
| Auth 服务不可达 | 托盘红色，提示"无法连接认证服务，请检查网络" |
| Token 未授权 / 已绑定其他设备 | Settings 页显示具体错误，引导用户处理 |
| Gateway 断连 | 自动重连（指数退避），Activity 记录，托盘变红 |
| Sidecar 崩溃 | Tauri 自动重启 Sidecar，通知用户 |
| 任务超时 | 按 timeout_ms 强制中止，回报 timeout |
| 用户拒绝审批 | 回报 rejected，记录日志 |
| 能力模块未启用 | 立即回报 capability_disabled |

---

## 九、测试策略

- **单元测试：** Rust 核心逻辑（ws_client、approval_queue）、Sidecar 各模块 mock 测试、React 关键组件
- **集成测试：** Tauri ↔ Sidecar IPC 通信链路
- **E2E（Playwright）：** Token 绑定 → 收到任务 → 审批 → 执行 → 查看日志

---

## 十、关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 执行引擎语言 | Node.js Sidecar | 避免复杂 Rust 开发，后期可切换为 Python |
| 状态管理 | Zustand | 轻量，无 Redux 样板，适合桌面应用 |
| 节点认证 | Auth HTTP + Token | 绑定逻辑在服务端，客户端无感知 |
| 云端 WebUI 访问 | 内嵌 Tauri WebView 窗口 | 无需跳转外部浏览器，体验一致 |
| UI 设计语言 | Material Design 3 | 目标用户熟悉 Google 系产品风格 |

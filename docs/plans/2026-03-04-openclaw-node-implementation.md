# OpenClaw Node 桌面客户端实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 Tauri v2 + React (Vite/TypeScript) + TailwindCSS 构建一个 AI 桌面执行节点客户端，接收远程 Gateway 任务并在本地执行。

**Architecture:** Tauri Rust 核心负责 WebSocket 通信、Auth 验证、任务调度和审批队列；Node.js Sidecar 负责实际执行（浏览器自动化、系统操作、视觉能力）；React 前端提供 Material Design 3 风格的仪表盘 UI，并常驻系统托盘。

**Tech Stack:** Tauri v2, React 18, Vite, TypeScript, TailwindCSS v3, Zustand, React Router v6, Playwright (sidecar), Vitest

---

## Phase 1: 项目初始化与基础配置

### Task 1: 初始化 Tauri v2 + React 项目

**Files:**
- Create: `package.json`, `src-tauri/`, `src/`, `vite.config.ts`

**Step 1: 在项目根目录创建 Tauri 应用**

```bash
cd D:/Resources/MyWorkspace/frontend/myproject/easy-openclaw
npm create tauri-app@latest . -- --template react-ts --manager npm
```

当提示时选择：
- App name: `easy-openclaw`
- Window title: `OpenClaw Node`
- Frontend dist dir: `../dist`
- Dev command: `npm run dev`

**Step 2: 安装前端依赖**

```bash
npm install
npm install react-router-dom zustand
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```

**Step 3: 安装 Tauri 插件**

```bash
npm install @tauri-apps/plugin-store @tauri-apps/plugin-shell @tauri-apps/plugin-notification
cd src-tauri
cargo add tauri-plugin-store tauri-plugin-shell tauri-plugin-notification
cd ..
```

**Step 4: 验证项目启动**

```bash
npm run tauri dev
```

预期：弹出 Tauri 窗口，显示默认 React 页面

**Step 5: 提交**

```bash
git init
git add .
git commit -m "feat: initialize Tauri v2 + React + TypeScript project"
```

---

### Task 2: 配置 TailwindCSS + Material Design 3 主题

**Files:**
- Create: `tailwind.config.ts`
- Create: `src/styles/tokens.css`
- Modify: `src/main.tsx`
- Modify: `postcss.config.js`

**Step 1: 安装 TailwindCSS**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p --ts
```

**Step 2: 配置 tailwind.config.ts**

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Material Design 3 色彩 Token
        primary: {
          DEFAULT: '#6750A4',
          container: '#EADDFF',
          on: '#FFFFFF',
          'on-container': '#21005D',
        },
        secondary: {
          DEFAULT: '#625B71',
          container: '#E8DEF8',
          on: '#FFFFFF',
          'on-container': '#1D192B',
        },
        surface: {
          DEFAULT: '#FFFBFE',
          variant: '#E7E0EC',
          on: '#1C1B1F',
          'on-variant': '#49454F',
        },
        error: {
          DEFAULT: '#B3261E',
          container: '#F9DEDC',
          on: '#FFFFFF',
          'on-container': '#410E0B',
        },
        outline: '#79747E',
        background: '#FFFBFE',
      },
      borderRadius: {
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      fontFamily: {
        sans: ['Inter', 'Google Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'elevation-1': '0 1px 2px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
        'elevation-2': '0 2px 6px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
}

export default config
```

**Step 3: 创建全局样式 src/styles/tokens.css**

```css
/* src/styles/tokens.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    box-sizing: border-box;
  }
  body {
    @apply bg-background text-surface-on font-sans;
    -webkit-font-smoothing: antialiased;
  }
  /* Material Ripple 基础 */
  .ripple {
    @apply relative overflow-hidden;
  }
  .ripple::after {
    content: '';
    @apply absolute inset-0 bg-current opacity-0 transition-opacity duration-200 rounded-inherit;
  }
  .ripple:active::after {
    @apply opacity-10;
  }
}
```

**Step 4: 修改 src/main.tsx 引入样式**

```typescript
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/tokens.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**Step 5: 配置 Vitest（修改 vite.config.ts）**

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  // Tauri 需要固定端口
  server: {
    port: 1420,
    strictPort: true,
  },
})
```

**Step 6: 创建 Vitest setup 文件**

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
```

**Step 7: 运行验证**

```bash
npm run dev
```

预期：页面应用新的字体和颜色体系

**Step 8: 提交**

```bash
git add .
git commit -m "feat: configure TailwindCSS with Material Design 3 tokens"
```

---

## Phase 2: 类型定义与状态管理

### Task 3: 定义核心 TypeScript 类型

**Files:**
- Create: `src/types/index.ts`

**Step 1: 编写类型文件**

```typescript
// src/types/index.ts

export type TaskType = 'browser' | 'system' | 'vision'
export type LogLevel = 'success' | 'error' | 'warning' | 'info' | 'pending'
export type ApprovalMode = 'always' | 'never' | 'sensitive_only'
export type NodeStatus = 'idle' | 'auth_checking' | 'authorized' | 'connecting' | 'online' | 'unauthorized' | 'error' | 'paused'

export interface Task {
  task_id: string
  type: TaskType
  payload: Record<string, unknown>
  require_approval: boolean
  timeout_ms: number
}

export interface ActivityLog {
  id: string
  timestamp: Date
  task_id: string
  level: LogLevel
  title: string
  description: string
  tags: string[]
}

export interface Capabilities {
  browser: boolean
  system: boolean
  vision: boolean
}

export interface ApprovalRules {
  browser: ApprovalMode
  system: ApprovalMode
  vision: ApprovalMode
}

export interface NodeConfig {
  token: string
  machine_id: string
  auth_endpoint: string
  gateway_endpoint: string
  cloud_console_url: string
}

export interface PendingApproval {
  task: Task
  resolve: (approved: boolean) => void
}

export interface TaskStats {
  total: number
  success: number
  error: number
  pending: number
}
```

**Step 2: 写类型单元测试**

```typescript
// src/types/index.test.ts
import type { Task, ActivityLog, NodeConfig } from './index'

// 类型测试：验证类型结构正确
describe('Types', () => {
  it('Task type has required fields', () => {
    const task: Task = {
      task_id: 'test-1',
      type: 'browser',
      payload: {},
      require_approval: false,
      timeout_ms: 5000,
    }
    expect(task.task_id).toBe('test-1')
    expect(task.type).toBe('browser')
  })

  it('ActivityLog level accepts valid values', () => {
    const log: ActivityLog = {
      id: '1',
      timestamp: new Date(),
      task_id: 'task-1',
      level: 'success',
      title: 'Test',
      description: 'Test log',
      tags: ['BROWSER'],
    }
    expect(log.level).toBe('success')
  })
})
```

**Step 3: 运行测试**

```bash
npx vitest run src/types/index.test.ts
```

预期：PASS

**Step 4: 提交**

```bash
git add src/types/
git commit -m "feat: add core TypeScript type definitions"
```

---

### Task 4: 创建 Zustand Stores

**Files:**
- Create: `src/store/config.store.ts`
- Create: `src/store/connection.store.ts`
- Create: `src/store/tasks.store.ts`
- Create: `src/store/index.ts`

**Step 1: 创建 config store**

```typescript
// src/store/config.store.ts
import { create } from 'zustand'
import type { Capabilities, ApprovalRules, NodeConfig } from '../types'

interface ConfigState {
  config: NodeConfig
  capabilities: Capabilities
  approvalRules: ApprovalRules
  setToken: (token: string) => void
  setAuthEndpoint: (url: string) => void
  setGatewayEndpoint: (url: string) => void
  setCloudConsoleUrl: (url: string) => void
  toggleCapability: (key: keyof Capabilities) => void
  setApprovalRule: (key: keyof ApprovalRules, mode: ApprovalRules[keyof ApprovalRules]) => void
}

const defaultConfig: NodeConfig = {
  token: '',
  machine_id: '',
  auth_endpoint: '',
  gateway_endpoint: '',
  cloud_console_url: '',
}

const defaultCapabilities: Capabilities = {
  browser: true,
  system: false,
  vision: true,
}

const defaultApprovalRules: ApprovalRules = {
  browser: 'sensitive_only',
  system: 'always',
  vision: 'never',
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: defaultConfig,
  capabilities: defaultCapabilities,
  approvalRules: defaultApprovalRules,

  setToken: (token) =>
    set((state) => ({ config: { ...state.config, token } })),

  setAuthEndpoint: (auth_endpoint) =>
    set((state) => ({ config: { ...state.config, auth_endpoint } })),

  setGatewayEndpoint: (gateway_endpoint) =>
    set((state) => ({ config: { ...state.config, gateway_endpoint } })),

  setCloudConsoleUrl: (cloud_console_url) =>
    set((state) => ({ config: { ...state.config, cloud_console_url } })),

  toggleCapability: (key) =>
    set((state) => ({
      capabilities: { ...state.capabilities, [key]: !state.capabilities[key] },
    })),

  setApprovalRule: (key, mode) =>
    set((state) => ({
      approvalRules: { ...state.approvalRules, [key]: mode },
    })),
}))
```

**Step 2: 创建 connection store**

```typescript
// src/store/connection.store.ts
import { create } from 'zustand'
import type { NodeStatus } from '../types'

interface ConnectionState {
  status: NodeStatus
  errorMessage: string | null
  onlineAt: Date | null
  setStatus: (status: NodeStatus) => void
  setError: (message: string) => void
  clearError: () => void
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'idle',
  errorMessage: null,
  onlineAt: null,

  setStatus: (status) =>
    set((state) => ({
      status,
      onlineAt: status === 'online' ? new Date() : state.onlineAt,
      errorMessage: status !== 'error' && status !== 'unauthorized' ? null : state.errorMessage,
    })),

  setError: (errorMessage) =>
    set({ errorMessage, status: 'error' }),

  clearError: () =>
    set({ errorMessage: null }),
}))
```

**Step 3: 创建 tasks store**

```typescript
// src/store/tasks.store.ts
import { create } from 'zustand'
import type { ActivityLog, PendingApproval, TaskStats } from '../types'

interface TasksState {
  logs: ActivityLog[]
  pendingApprovals: PendingApproval[]
  addLog: (log: ActivityLog) => void
  addPendingApproval: (approval: PendingApproval) => void
  removePendingApproval: (task_id: string) => void
  getStats: () => TaskStats
}

export const useTasksStore = create<TasksState>((set, get) => ({
  logs: [],
  pendingApprovals: [],

  addLog: (log) =>
    set((state) => ({ logs: [log, ...state.logs].slice(0, 500) })),

  addPendingApproval: (approval) =>
    set((state) => ({
      pendingApprovals: [...state.pendingApprovals, approval],
    })),

  removePendingApproval: (task_id) =>
    set((state) => ({
      pendingApprovals: state.pendingApprovals.filter(
        (a) => a.task.task_id !== task_id
      ),
    })),

  getStats: () => {
    const { logs } = get()
    return {
      total: logs.length,
      success: logs.filter((l) => l.level === 'success').length,
      error: logs.filter((l) => l.level === 'error').length,
      pending: logs.filter((l) => l.level === 'pending').length,
    }
  },
}))
```

**Step 4: 创建 store barrel 文件**

```typescript
// src/store/index.ts
export { useConfigStore } from './config.store'
export { useConnectionStore } from './connection.store'
export { useTasksStore } from './tasks.store'
```

**Step 5: 写 store 测试**

```typescript
// src/store/config.store.test.ts
import { act, renderHook } from '@testing-library/react'
import { useConfigStore } from './config.store'

describe('useConfigStore', () => {
  beforeEach(() => {
    useConfigStore.setState({
      config: { token: '', machine_id: '', auth_endpoint: '', gateway_endpoint: '', cloud_console_url: '' },
      capabilities: { browser: true, system: false, vision: true },
      approvalRules: { browser: 'sensitive_only', system: 'always', vision: 'never' },
    })
  })

  it('setToken updates token immutably', () => {
    const { result } = renderHook(() => useConfigStore())
    act(() => result.current.setToken('test-token-123'))
    expect(result.current.config.token).toBe('test-token-123')
    expect(result.current.config.auth_endpoint).toBe('')
  })

  it('toggleCapability flips the value', () => {
    const { result } = renderHook(() => useConfigStore())
    act(() => result.current.toggleCapability('system'))
    expect(result.current.capabilities.system).toBe(true)
    act(() => result.current.toggleCapability('system'))
    expect(result.current.capabilities.system).toBe(false)
  })
})
```

**Step 6: 运行 store 测试**

```bash
npx vitest run src/store/
```

预期：PASS

**Step 7: 提交**

```bash
git add src/store/
git commit -m "feat: add Zustand stores for config, connection and tasks"
```

---

## Phase 3: UI 基础组件库（Material Design 3）

### Task 5: 创建基础 UI 组件

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Badge.tsx`
- Create: `src/components/ui/Switch.tsx`
- Create: `src/components/ui/index.ts`

**Step 1: 创建 Button 组件**

```typescript
// src/components/ui/Button.tsx
import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'outlined' | 'text'
  size?: 'sm' | 'md'
}

export function Button({
  variant = 'filled',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 ripple select-none disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm' }
  const variants = {
    filled: 'bg-primary text-primary-on hover:shadow-elevation-1 active:shadow-none',
    outlined: 'border border-outline text-primary hover:bg-primary/8',
    text: 'text-primary hover:bg-primary/8',
  }
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
```

**Step 2: 创建 Card 组件**

```typescript
// src/components/ui/Card.tsx
import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  elevated?: boolean
}

export function Card({ children, className = '', elevated = false }: CardProps) {
  return (
    <div
      className={`bg-surface rounded-xl p-4 ${elevated ? 'shadow-elevation-2' : 'border border-surface-variant'} ${className}`}
    >
      {children}
    </div>
  )
}
```

**Step 3: 创建 Badge 组件**

```typescript
// src/components/ui/Badge.tsx
interface BadgeProps {
  label: string
  color?: 'success' | 'error' | 'warning' | 'info' | 'default'
}

const colorMap = {
  success: 'bg-[#D4EDDA] text-[#155724]',
  error: 'bg-error-container text-error-on-container',
  warning: 'bg-[#FFF3CD] text-[#856404]',
  info: 'bg-secondary-container text-secondary-on-container',
  default: 'bg-surface-variant text-surface-on-variant',
}

export function Badge({ label, color = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorMap[color]}`}>
      {label}
    </span>
  )
}
```

**Step 4: 创建 Switch 组件**

```typescript
// src/components/ui/Switch.tsx
interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <label className={`flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <div
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-primary' : 'bg-surface-variant'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-0'}`}
        />
      </div>
      {label && <span className="text-sm text-surface-on">{label}</span>}
    </label>
  )
}
```

**Step 5: 创建 barrel 文件**

```typescript
// src/components/ui/index.ts
export { Button } from './Button'
export { Card } from './Card'
export { Badge } from './Badge'
export { Switch } from './Switch'
```

**Step 6: 写组件测试**

```typescript
// src/components/ui/Switch.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Switch } from './Switch'

describe('Switch', () => {
  it('calls onChange with toggled value', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} label="Test" />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} disabled />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

**Step 7: 运行测试**

```bash
npx vitest run src/components/ui/
```

预期：PASS

**Step 8: 提交**

```bash
git add src/components/ui/
git commit -m "feat: add Material Design 3 base UI components"
```

---

## Phase 4: 布局骨架

### Task 6: 创建应用布局（Sidebar + TopBar + Router）

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/TopBar.tsx`
- Create: `src/components/layout/AppLayout.tsx`
- Modify: `src/App.tsx`

**Step 1: 创建 Sidebar**

```typescript
// src/components/layout/Sidebar.tsx
import { NavLink } from 'react-router-dom'
import { useConnectionStore } from '../../store'

const navItems = [
  { to: '/', icon: '⊞', label: 'Dashboard' },
  { to: '/activity', icon: '⚡', label: 'Activity' },
  { to: '/capabilities', icon: '🔌', label: 'Capabilities' },
  { to: '/analytics', icon: '📈', label: 'Analytics' },
]

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  connecting: 'bg-yellow-500',
  auth_checking: 'bg-yellow-500',
  authorized: 'bg-yellow-500',
  error: 'bg-red-500',
  unauthorized: 'bg-red-500',
  idle: 'bg-gray-400',
  paused: 'bg-gray-400',
}

export function Sidebar() {
  const { status } = useConnectionStore()

  return (
    <aside className="w-56 h-screen bg-surface border-r border-surface-variant flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-surface-variant">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-sm font-bold">OC</div>
          <div>
            <div className="text-sm font-semibold text-surface-on">OpenClaw Node</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${statusColors[status] ?? 'bg-gray-400'}`} />
              <span className="text-xs text-surface-on-variant capitalize">{status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                isActive
                  ? 'bg-secondary-container text-secondary-on-container font-medium'
                  : 'text-surface-on-variant hover:bg-surface-variant'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom items */}
      <div className="p-2 border-t border-surface-variant space-y-1">
        <button
          onClick={() => {/* open cloud console webview */}}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-surface-on-variant hover:bg-surface-variant transition-colors"
        >
          <span>🌐</span>
          云端控制台
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-secondary-container text-secondary-on-container font-medium'
                : 'text-surface-on-variant hover:bg-surface-variant'
            }`
          }
        >
          <span>⚙️</span>
          Settings
        </NavLink>
      </div>
    </aside>
  )
}
```

**Step 2: 创建 TopBar**

```typescript
// src/components/layout/TopBar.tsx
interface TopBarProps {
  title: string
  subtitle?: string
}

export function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <div className="h-14 border-b border-surface-variant bg-surface flex items-center px-6 flex-shrink-0">
      <div className="flex-1">
        <h1 className="text-base font-semibold text-surface-on">{title}</h1>
        {subtitle && <p className="text-xs text-surface-on-variant mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
```

**Step 3: 创建 AppLayout**

```typescript
// src/components/layout/AppLayout.tsx
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
```

**Step 4: 创建页面骨架文件（占位）**

```typescript
// src/pages/DashboardPage.tsx
import { TopBar } from '../components/layout/TopBar'
export function DashboardPage() {
  return (
    <>
      <TopBar title="Dashboard" subtitle="Node status and real-time tasks" />
      <div className="flex-1 overflow-auto p-6">
        <p className="text-surface-on-variant">Dashboard - coming soon</p>
      </div>
    </>
  )
}
```

同样创建以下占位页面（内容结构一致，改 title 即可）：
- `src/pages/ActivityPage.tsx` — title: "Activity" / subtitle: "Real-time task execution logs"
- `src/pages/CapabilitiesPage.tsx` — title: "Capabilities" / subtitle: "Enable or disable execution modules"
- `src/pages/AnalyticsPage.tsx` — title: "Analytics" / subtitle: "Task statistics"
- `src/pages/SettingsPage.tsx` — title: "Settings" / subtitle: "Configure your node"

**Step 5: 修改 App.tsx 配置路由**

```typescript
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ActivityPage } from './pages/ActivityPage'
import { CapabilitiesPage } from './pages/CapabilitiesPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="capabilities" element={<CapabilitiesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

**Step 6: 验证布局**

```bash
npm run tauri dev
```

预期：左侧边栏正常显示，点击导航项切换页面

**Step 7: 提交**

```bash
git add src/components/layout/ src/pages/ src/App.tsx
git commit -m "feat: add app layout with Material Design sidebar and routing"
```

---

## Phase 5: Rust 核心层

### Task 7: 配置 Tauri 插件与基础 Rust 结构

**Files:**
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/tauri.conf.json`

**Step 1: 修改 main.rs 注册插件**

```rust
// src-tauri/src/main.rs
mod config;
mod auth_client;
mod ws_client;
mod task_dispatcher;
mod approval_queue;
mod tray;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            tray::setup_tray(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            config::get_config,
            config::save_config,
            auth_client::check_auth,
            ws_client::connect_gateway,
            ws_client::disconnect_gateway,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 2: 创建 config.rs**

```rust
// src-tauri/src/config.rs
use serde::{Deserialize, Serialize};
use tauri::State;
use tauri_plugin_store::StoreExt;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct NodeConfig {
    pub token: String,
    pub auth_endpoint: String,
    pub gateway_endpoint: String,
    pub cloud_console_url: String,
}

#[tauri::command]
pub fn get_config(app: tauri::AppHandle) -> Result<NodeConfig, String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    let config = store
        .get("node_config")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default();
    Ok(config)
}

#[tauri::command]
pub fn save_config(app: tauri::AppHandle, config: NodeConfig) -> Result<(), String> {
    let store = app.store("config.json").map_err(|e| e.to_string())?;
    store.set("node_config", serde_json::to_value(&config).map_err(|e| e.to_string())?);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
```

**Step 3: 创建 auth_client.rs**

```rust
// src-tauri/src/auth_client.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthRequest {
    pub token: String,
    pub machine_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub allowed: bool,
    pub message: Option<String>,
}

#[tauri::command]
pub async fn check_auth(
    auth_endpoint: String,
    token: String,
    machine_id: String,
) -> Result<AuthResponse, String> {
    let client = reqwest::Client::new();
    let payload = AuthRequest { token, machine_id };

    let response = client
        .post(&auth_endpoint)
        .json(&payload)
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Auth request failed: {}", e))?;

    let auth_response = response
        .json::<AuthResponse>()
        .await
        .map_err(|e| format!("Invalid auth response: {}", e))?;

    Ok(auth_response)
}
```

**Step 4: 添加 reqwest 依赖**

```bash
cd src-tauri
cargo add reqwest --features json
cd ..
```

**Step 5: 创建 tray.rs 基础实现**

```rust
// src-tauri/src/tray.rs
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let open = MenuItem::with_id(app, "open", "打开控制台", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
```

**Step 6: 编译验证**

```bash
cd src-tauri && cargo check && cd ..
```

预期：编译无错误（可能有 warnings，可忽略）

**Step 7: 提交**

```bash
git add src-tauri/
git commit -m "feat: add Rust core - config, auth client, tray setup"
```

---

### Task 8: WebSocket 客户端（Rust）

**Files:**
- Create: `src-tauri/src/ws_client.rs`

**Step 1: 添加 WebSocket 依赖**

```bash
cd src-tauri
cargo add tokio-tungstenite --features native-tls
cargo add tokio --features full
cd ..
```

**Step 2: 实现 ws_client.rs**

```rust
// src-tauri/src/ws_client.rs
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WsTask {
    pub task_id: String,
    pub r#type: String,
    pub payload: serde_json::Value,
    pub require_approval: bool,
    pub timeout_ms: u64,
}

#[derive(Debug, Serialize, Clone)]
pub struct TaskResult {
    pub task_id: String,
    pub status: String,
    pub result: Option<serde_json::Value>,
}

#[tauri::command]
pub async fn connect_gateway(
    app: tauri::AppHandle,
    gateway_url: String,
    token: String,
) -> Result<(), String> {
    let url = format!("{}?token={}", gateway_url, token);

    tauri::async_runtime::spawn(async move {
        match connect_async(&url).await {
            Ok((ws_stream, _)) => {
                app.emit("ws:connected", ()).ok();

                let (mut write, mut read) = ws_stream.split();

                while let Some(msg) = read.next().await {
                    match msg {
                        Ok(Message::Text(text)) => {
                            if let Ok(task) = serde_json::from_str::<WsTask>(&text) {
                                app.emit("ws:task", &task).ok();
                            }
                        }
                        Ok(Message::Close(_)) => {
                            app.emit("ws:disconnected", ()).ok();
                            break;
                        }
                        Err(e) => {
                            app.emit("ws:error", e.to_string()).ok();
                            break;
                        }
                        _ => {}
                    }
                }
            }
            Err(e) => {
                app.emit("ws:error", e.to_string()).ok();
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn disconnect_gateway() -> Result<(), String> {
    // 后续版本实现通过共享状态断开连接
    Ok(())
}
```

**Step 3: 编译验证**

```bash
cd src-tauri && cargo check && cd ..
```

**Step 4: 提交**

```bash
git add src-tauri/src/ws_client.rs
git commit -m "feat: add WebSocket client for Gateway communication"
```

---

## Phase 6: React 前端 Tauri 集成层

### Task 9: 创建 Tauri IPC Hook

**Files:**
- Create: `src/hooks/useTauri.ts`
- Create: `src/hooks/useNodeConnection.ts`

**Step 1: 创建 useTauri hook**

```typescript
// src/hooks/useTauri.ts
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect } from 'react'

export function useInvoke() {
  return invoke
}

export function useTauriEvent<T>(event: string, handler: (payload: T) => void) {
  useEffect(() => {
    const unlisten = listen<T>(event, (e) => handler(e.payload))
    return () => { unlisten.then((fn) => fn()) }
  }, [event, handler])
}
```

**Step 2: 创建 useNodeConnection hook**

```typescript
// src/hooks/useNodeConnection.ts
import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useConnectionStore } from '../store'
import { useConfigStore } from '../store'
import { useTauriEvent } from './useTauri'

export function useNodeConnection() {
  const { setStatus, setError } = useConnectionStore()
  const { config } = useConfigStore()

  // 监听 WebSocket 事件
  useTauriEvent('ws:connected', useCallback(() => setStatus('online'), [setStatus]))
  useTauriEvent('ws:disconnected', useCallback(() => setStatus('idle'), [setStatus]))
  useTauriEvent<string>('ws:error', useCallback((msg) => setError(msg), [setError]))

  const connect = useCallback(async () => {
    if (!config.token || !config.auth_endpoint || !config.gateway_endpoint) {
      setError('请先在 Settings 中配置 Token 和端点地址')
      return
    }

    try {
      setStatus('auth_checking')

      const authResult = await invoke<{ allowed: boolean; message?: string }>('check_auth', {
        authEndpoint: config.auth_endpoint,
        token: config.token,
        machineId: await getMachineId(),
      })

      if (!authResult.allowed) {
        setStatus('unauthorized')
        setError(authResult.message ?? 'Token 已绑定其他设备，请联系管理员解绑')
        return
      }

      setStatus('connecting')
      await invoke('connect_gateway', {
        gatewayUrl: config.gateway_endpoint,
        token: config.token,
      })
    } catch (e) {
      setError(String(e))
    }
  }, [config, setStatus, setError])

  return { connect }
}

async function getMachineId(): Promise<string> {
  // 简化版：用 localStorage 持久化随机 ID
  // 生产版本可通过 Tauri 获取真实硬件 ID
  let id = localStorage.getItem('machine_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('machine_id', id)
  }
  return id
}
```

**Step 3: 提交**

```bash
git add src/hooks/
git commit -m "feat: add Tauri IPC hooks and node connection logic"
```

---

## Phase 7: 核心功能页面

### Task 10: Settings 页面

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

**Step 1: 实现 Settings 页面**

```typescript
// src/pages/SettingsPage.tsx
import { useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { Card, Button } from '../components/ui'
import { useConfigStore } from '../store'
import { useNodeConnection } from '../hooks/useNodeConnection'
import { useConnectionStore } from '../store'

export function SettingsPage() {
  const { config, approvalRules, setToken, setAuthEndpoint, setGatewayEndpoint, setCloudConsoleUrl, setApprovalRule } = useConfigStore()
  const { status, errorMessage } = useConnectionStore()
  const { connect } = useNodeConnection()

  const [localToken, setLocalToken] = useState(config.token)
  const [localAuth, setLocalAuth] = useState(config.auth_endpoint)
  const [localGateway, setLocalGateway] = useState(config.gateway_endpoint)
  const [localConsole, setLocalConsole] = useState(config.cloud_console_url)

  const handleSave = async () => {
    setToken(localToken)
    setAuthEndpoint(localAuth)
    setGatewayEndpoint(localGateway)
    setCloudConsoleUrl(localConsole)
    await connect()
  }

  const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-outline bg-surface text-surface-on focus:outline-none focus:ring-2 focus:ring-primary/50'

  return (
    <>
      <TopBar title="Settings" subtitle="Configure your node" />
      <div className="flex-1 overflow-auto p-6 space-y-4 max-w-2xl">

        {/* 连接配置 */}
        <Card>
          <h2 className="text-sm font-semibold text-surface-on mb-4">Node Connection</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-surface-on-variant mb-1 block">Token</label>
              <input
                type="password"
                value={localToken}
                onChange={(e) => setLocalToken(e.target.value)}
                placeholder="输入节点 Token"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-surface-on-variant mb-1 block">Auth Service Endpoint</label>
              <input
                value={localAuth}
                onChange={(e) => setLocalAuth(e.target.value)}
                placeholder="https://auth.example.com/node-connect"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-surface-on-variant mb-1 block">Gateway Endpoint</label>
              <input
                value={localGateway}
                onChange={(e) => setLocalGateway(e.target.value)}
                placeholder="wss://gateway.example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-surface-on-variant mb-1 block">Cloud Console URL</label>
              <input
                value={localConsole}
                onChange={(e) => setLocalConsole(e.target.value)}
                placeholder="https://console.example.com"
                className={inputClass}
              />
            </div>

            {errorMessage && (
              <div className="p-3 rounded-lg bg-error-container text-error-on-container text-sm">
                {errorMessage}
              </div>
            )}

            <Button onClick={handleSave} disabled={status === 'auth_checking' || status === 'connecting'}>
              {status === 'auth_checking' ? '验证中...' : status === 'connecting' ? '连接中...' : '保存并连接'}
            </Button>
          </div>
        </Card>

        {/* 审批规则 */}
        <Card>
          <h2 className="text-sm font-semibold text-surface-on mb-4">Approval Rules</h2>
          <div className="space-y-3">
            {(['browser', 'system', 'vision'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-surface-on capitalize">{key}</span>
                <select
                  value={approvalRules[key]}
                  onChange={(e) => setApprovalRule(key, e.target.value as any)}
                  className="text-sm px-2 py-1 rounded-lg border border-outline bg-surface text-surface-on"
                >
                  <option value="always">总是询问</option>
                  <option value="sensitive_only">敏感操作询问</option>
                  <option value="never">不询问</option>
                </select>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
```

**Step 2: 提交**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: implement Settings page with token binding and approval rules"
```

---

### Task 11: Activity 页面（时间轴日志）

**Files:**
- Create: `src/components/features/activity/ActivityItem.tsx`
- Modify: `src/pages/ActivityPage.tsx`

**Step 1: 写 ActivityItem 测试**

```typescript
// src/components/features/activity/ActivityItem.test.tsx
import { render, screen } from '@testing-library/react'
import { ActivityItem } from './ActivityItem'
import type { ActivityLog } from '../../../types'

const mockLog: ActivityLog = {
  id: '1',
  timestamp: new Date('2026-03-04T14:30:00'),
  task_id: 'task-1',
  level: 'success',
  title: 'Browser task completed',
  description: 'Searched for weather info',
  tags: ['SUCCESS', 'BROWSER'],
}

describe('ActivityItem', () => {
  it('renders title and description', () => {
    render(<ActivityItem log={mockLog} />)
    expect(screen.getByText('Browser task completed')).toBeInTheDocument()
    expect(screen.getByText('Searched for weather info')).toBeInTheDocument()
  })

  it('renders tags', () => {
    render(<ActivityItem log={mockLog} />)
    expect(screen.getByText('SUCCESS')).toBeInTheDocument()
    expect(screen.getByText('BROWSER')).toBeInTheDocument()
  })
})
```

**Step 2: 运行测试（应失败）**

```bash
npx vitest run src/components/features/activity/
```

预期：FAIL - ActivityItem not found

**Step 3: 实现 ActivityItem**

```typescript
// src/components/features/activity/ActivityItem.tsx
import { Badge } from '../../ui'
import type { ActivityLog, LogLevel } from '../../../types'

const dotColors: Record<LogLevel, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
  pending: 'bg-orange-400 animate-pulse',
}

const badgeColors: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  PENDING: 'warning',
  BROWSER: 'info',
  SYSTEM: 'default',
  VISION: 'default',
}

interface ActivityItemProps {
  log: ActivityLog
}

export function ActivityItem({ log }: ActivityItemProps) {
  const time = log.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${dotColors[log.level]}`} />
        <div className="w-px flex-1 bg-surface-variant mt-1" />
      </div>
      <div className="pb-4 flex-1">
        <p className="text-xs text-surface-on-variant mb-1">{time}</p>
        <div className="bg-surface border border-surface-variant rounded-xl p-4 shadow-elevation-1">
          <p className="text-sm font-medium text-surface-on">{log.title}</p>
          <p className="text-xs text-surface-on-variant mt-0.5">{log.description}</p>
          {log.tags.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {log.tags.map((tag) => (
                <Badge key={tag} label={tag} color={badgeColors[tag] ?? 'default'} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 4: 运行测试（应通过）**

```bash
npx vitest run src/components/features/activity/
```

预期：PASS

**Step 5: 实现 ActivityPage**

```typescript
// src/pages/ActivityPage.tsx
import { useState } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { ActivityItem } from '../components/features/activity/ActivityItem'
import { useTasksStore } from '../store'
import type { LogLevel } from '../types'

const tabs: { label: string; filter: LogLevel | 'all' }[] = [
  { label: 'All Activity', filter: 'all' },
  { label: 'Errors', filter: 'error' },
  { label: 'Successes', filter: 'success' },
  { label: 'Warnings', filter: 'warning' },
]

export function ActivityPage() {
  const { logs } = useTasksStore()
  const [activeTab, setActiveTab] = useState<LogLevel | 'all'>('all')

  const filtered = activeTab === 'all' ? logs : logs.filter((l) => l.level === activeTab)

  return (
    <>
      <TopBar title="Activity" subtitle="Real-time task execution logs across all modules" />
      <div className="flex-1 overflow-auto">
        {/* Tabs */}
        <div className="flex gap-0 px-6 border-b border-surface-variant">
          {tabs.map(({ label, filter }) => (
            <button
              key={filter}
              onClick={() => setActiveTab(filter)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === filter
                  ? 'border-primary text-primary'
                  : 'border-transparent text-surface-on-variant hover:text-surface-on'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="px-6 pt-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-surface-on-variant py-8 text-center">暂无活动日志</p>
          ) : (
            filtered.map((log) => <ActivityItem key={log.id} log={log} />)
          )}
        </div>
      </div>
    </>
  )
}
```

**Step 6: 提交**

```bash
git add src/components/features/activity/ src/pages/ActivityPage.tsx
git commit -m "feat: implement Activity page with Material Design timeline"
```

---

### Task 12: Capabilities 页面

**Files:**
- Modify: `src/pages/CapabilitiesPage.tsx`

**Step 1: 实现 Capabilities 页面**

```typescript
// src/pages/CapabilitiesPage.tsx
import { TopBar } from '../components/layout/TopBar'
import { Card, Switch } from '../components/ui'
import { useConfigStore } from '../store'

const modules = [
  {
    key: 'browser' as const,
    icon: '🌐',
    title: '浏览器自动化',
    description: '使用 Playwright 控制 Chrome/Firefox 执行网页操作、表单填写、数据抓取',
  },
  {
    key: 'system' as const,
    icon: '🖥️',
    title: '系统操作',
    description: '文件管理、进程控制、执行系统命令。注意：此模块风险较高，建议设置审批规则',
  },
  {
    key: 'vision' as const,
    icon: '👁️',
    title: '视觉/OCR',
    description: '屏幕截图、OCR 文字识别、图像分析能力',
  },
]

export function CapabilitiesPage() {
  const { capabilities, toggleCapability } = useConfigStore()

  return (
    <>
      <TopBar title="Capabilities" subtitle="Enable or disable execution modules" />
      <div className="flex-1 overflow-auto p-6 space-y-3 max-w-2xl">
        {modules.map(({ key, icon, title, description }) => (
          <Card key={key}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{icon}</span>
                <div>
                  <p className="text-sm font-medium text-surface-on">{title}</p>
                  <p className="text-xs text-surface-on-variant mt-1 leading-relaxed">{description}</p>
                </div>
              </div>
              <Switch
                checked={capabilities[key]}
                onChange={() => toggleCapability(key)}
              />
            </div>
          </Card>
        ))}
      </div>
    </>
  )
}
```

**Step 2: 提交**

```bash
git add src/pages/CapabilitiesPage.tsx
git commit -m "feat: implement Capabilities page with module toggles"
```

---

### Task 13: Dashboard 页面

**Files:**
- Modify: `src/pages/DashboardPage.tsx`

**Step 1: 实现 Dashboard 页面**

```typescript
// src/pages/DashboardPage.tsx
import { TopBar } from '../components/layout/TopBar'
import { Card } from '../components/ui'
import { useConnectionStore, useTasksStore } from '../store'
import { useNodeConnection } from '../hooks/useNodeConnection'

const statusLabel: Record<string, string> = {
  online: '🟢 在线',
  connecting: '🟡 连接中',
  auth_checking: '🟡 验证中',
  authorized: '🟡 已授权',
  error: '🔴 错误',
  unauthorized: '🔴 未授权',
  idle: '⚫ 空闲',
  paused: '⚫ 已暂停',
}

export function DashboardPage() {
  const { status, onlineAt, errorMessage } = useConnectionStore()
  const { logs, pendingApprovals, getStats } = useTasksStore()
  const { connect } = useNodeConnection()
  const stats = getStats()

  const uptime = onlineAt
    ? Math.floor((Date.now() - onlineAt.getTime()) / 60000) + ' 分钟'
    : '--'

  return (
    <>
      <TopBar title="Dashboard" subtitle="Node status and real-time activity" />
      <div className="flex-1 overflow-auto p-6 space-y-4">

        {/* 状态卡片 */}
        <div className="grid grid-cols-3 gap-4">
          <Card elevated>
            <p className="text-xs text-surface-on-variant">节点状态</p>
            <p className="text-lg font-semibold text-surface-on mt-1">{statusLabel[status] ?? status}</p>
            <p className="text-xs text-surface-on-variant mt-1">在线时长：{uptime}</p>
          </Card>
          <Card elevated>
            <p className="text-xs text-surface-on-variant">今日任务</p>
            <p className="text-lg font-semibold text-surface-on mt-1">{stats.total}</p>
            <p className="text-xs text-surface-on-variant mt-1">成功 {stats.success} / 失败 {stats.error}</p>
          </Card>
          <Card elevated>
            <p className="text-xs text-surface-on-variant">成功率</p>
            <p className="text-lg font-semibold text-surface-on mt-1">
              {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : '--'}%
            </p>
            <p className="text-xs text-surface-on-variant mt-1">共 {stats.total} 条任务</p>
          </Card>
        </div>

        {/* 待审批 */}
        {pendingApprovals.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold text-surface-on mb-3">⚠️ 待审批操作 ({pendingApprovals.length})</h2>
            {pendingApprovals.map(({ task, resolve }) => (
              <div key={task.task_id} className="flex items-center justify-between p-3 rounded-lg bg-surface-variant mb-2">
                <div>
                  <p className="text-sm text-surface-on">{task.type} 操作</p>
                  <p className="text-xs text-surface-on-variant">Task #{task.task_id}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolve(false)}
                    className="px-3 py-1 text-xs rounded-lg border border-outline text-surface-on hover:bg-surface-variant"
                  >
                    拒绝
                  </button>
                  <button
                    onClick={() => resolve(true)}
                    className="px-3 py-1 text-xs rounded-lg bg-primary text-white hover:opacity-90"
                  >
                    允许执行
                  </button>
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* 错误提示 */}
        {errorMessage && (
          <Card>
            <p className="text-sm text-error">{errorMessage}</p>
          </Card>
        )}

        {/* 未连接时的引导 */}
        {(status === 'idle' || status === 'error') && (
          <Card>
            <p className="text-sm text-surface-on-variant mb-3">节点未连接，请前往 Settings 配置 Token 后连接。</p>
            <button
              onClick={connect}
              className="text-sm text-primary hover:underline"
            >
              立即连接 →
            </button>
          </Card>
        )}
      </div>
    </>
  )
}
```

**Step 2: 提交**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: implement Dashboard page with status cards and approval queue"
```

---

## Phase 8: Node.js Sidecar 执行引擎

### Task 14: 初始化 Sidecar 项目

**Files:**
- Create: `sidecar/package.json`
- Create: `sidecar/tsconfig.json`
- Create: `sidecar/src/types.ts`
- Create: `sidecar/src/index.ts`

**Step 1: 创建 sidecar 目录和 package.json**

```bash
mkdir -p sidecar/src/modules
```

```json
// sidecar/package.json
{
  "name": "openclaw-sidecar",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "ts-node src/index.ts",
    "test": "jest"
  },
  "dependencies": {
    "playwright": "^1.41.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0",
    "@types/node": "^20.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  }
}
```

**Step 2: 创建 tsconfig.json**

```json
// sidecar/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  }
}
```

**Step 3: 创建类型定义**

```typescript
// sidecar/src/types.ts
export type TaskType = 'browser' | 'system' | 'vision'

export interface SidecarTask {
  task_id: string
  type: TaskType
  payload: Record<string, unknown>
  timeout_ms: number
}

export interface SidecarResult {
  task_id: string
  status: 'success' | 'error' | 'timeout'
  result?: unknown
  error?: string
  logs: string[]
}

export interface IpcMessage {
  type: 'execute' | 'ping'
  data?: SidecarTask
}
```

**Step 4: 创建 IPC 入口**

```typescript
// sidecar/src/index.ts
import { SidecarTask, SidecarResult, IpcMessage } from './types'
import { executeBrowser } from './modules/browser'
import { executeSystem } from './modules/system'
import { executeVision } from './modules/vision'

// 通过 stdin/stdout 与 Tauri 通信
process.stdin.setEncoding('utf8')

let buffer = ''

process.stdin.on('data', (chunk: string) => {
  buffer += chunk
  const lines = buffer.split('\n')
  buffer = lines.pop() ?? ''

  for (const line of lines) {
    if (line.trim()) {
      try {
        const msg: IpcMessage = JSON.parse(line)
        handleMessage(msg)
      } catch {
        // ignore malformed input
      }
    }
  }
})

async function handleMessage(msg: IpcMessage) {
  if (msg.type === 'ping') {
    send({ type: 'pong' })
    return
  }

  if (msg.type === 'execute' && msg.data) {
    const result = await executeTask(msg.data)
    send({ type: 'result', data: result })
  }
}

async function executeTask(task: SidecarTask): Promise<SidecarResult> {
  const timeout = new Promise<SidecarResult>((resolve) =>
    setTimeout(() => resolve({
      task_id: task.task_id,
      status: 'timeout',
      error: `Task timed out after ${task.timeout_ms}ms`,
      logs: [],
    }), task.timeout_ms)
  )

  const execution = (async () => {
    try {
      switch (task.type) {
        case 'browser': return await executeBrowser(task)
        case 'system': return await executeSystem(task)
        case 'vision': return await executeVision(task)
        default: throw new Error(`Unknown task type: ${task.type}`)
      }
    } catch (e) {
      return {
        task_id: task.task_id,
        status: 'error' as const,
        error: String(e),
        logs: [],
      }
    }
  })()

  return Promise.race([timeout, execution])
}

function send(msg: unknown) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}
```

**Step 5: 创建各执行模块骨架**

```typescript
// sidecar/src/modules/browser.ts
import type { SidecarTask, SidecarResult } from '../types'

export async function executeBrowser(task: SidecarTask): Promise<SidecarResult> {
  const logs: string[] = []
  // TODO: Phase 2 实现 Playwright 操作
  logs.push(`[browser] Received task: ${JSON.stringify(task.payload)}`)
  return { task_id: task.task_id, status: 'success', result: null, logs }
}
```

```typescript
// sidecar/src/modules/system.ts
import type { SidecarTask, SidecarResult } from '../types'

export async function executeSystem(task: SidecarTask): Promise<SidecarResult> {
  const logs: string[] = []
  logs.push(`[system] Received task: ${JSON.stringify(task.payload)}`)
  return { task_id: task.task_id, status: 'success', result: null, logs }
}
```

```typescript
// sidecar/src/modules/vision.ts
import type { SidecarTask, SidecarResult } from '../types'

export async function executeVision(task: SidecarTask): Promise<SidecarResult> {
  const logs: string[] = []
  logs.push(`[vision] Received task: ${JSON.stringify(task.payload)}`)
  return { task_id: task.task_id, status: 'success', result: null, logs }
}
```

**Step 6: 安装依赖**

```bash
cd sidecar && npm install && cd ..
```

**Step 7: 提交**

```bash
git add sidecar/
git commit -m "feat: initialize Node.js sidecar execution engine with IPC bridge"
```

---

## Phase 9: 内嵌 WebView 窗口（云端控制台）

### Task 15: 实现云端控制台内嵌窗口

**Files:**
- Modify: `src-tauri/src/main.rs`（添加 command）
- Modify: `src/components/layout/Sidebar.tsx`（绑定按钮）

**Step 1: 在 Rust 中添加打开 WebView 命令**

```rust
// 在 main.rs 的 invoke_handler 中添加：
// open_cloud_console
```

```rust
// src-tauri/src/main.rs 中添加函数：
#[tauri::command]
async fn open_cloud_console(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;

    let existing = app.get_webview_window("cloud-console");
    if let Some(win) = existing {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "cloud-console", tauri::WebviewUrl::External(url.parse().map_err(|e: url::ParseError| e.to_string())?))
        .title("OpenClaw Cloud Console")
        .inner_size(1200.0, 800.0)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

**Step 2: 在 Sidebar 中绑定按钮**

```typescript
// 修改 Sidebar.tsx 中的云端控制台按钮：
import { invoke } from '@tauri-apps/api/core'
import { useConfigStore } from '../../store'

// 在组件内：
const { config } = useConfigStore()

const openConsole = async () => {
  if (!config.cloud_console_url) return
  await invoke('open_cloud_console', { url: config.cloud_console_url })
}
```

**Step 3: 提交**

```bash
git add src-tauri/src/main.rs src/components/layout/Sidebar.tsx
git commit -m "feat: implement embedded WebView for cloud console"
```

---

## Phase 10: 打包与最终验证

### Task 16: 打包配置与验证

**Step 1: 更新 tauri.conf.json 基础配置**

```json
// src-tauri/tauri.conf.json 关键字段：
{
  "productName": "OpenClaw Node",
  "version": "0.1.0",
  "app": {
    "windows": [
      {
        "title": "OpenClaw Node",
        "width": 980,
        "height": 680,
        "minWidth": 800,
        "minHeight": 600,
        "decorations": true,
        "transparent": false
      }
    ],
    "trayIcon": {
      "iconPath": "icons/icon.png"
    }
  }
}
```

**Step 2: 运行全量测试**

```bash
npx vitest run
```

预期：所有测试 PASS

**Step 3: 开发模式完整验证**

```bash
npm run tauri dev
```

验证清单：
- [ ] 应用正常启动，显示 Dashboard
- [ ] 侧边栏导航切换正常
- [ ] Settings 页面可输入 Token 和端点
- [ ] Capabilities 开关可切换
- [ ] Activity 标签页切换正常
- [ ] 系统托盘图标显示
- [ ] 托盘右键菜单可用

**Step 4: 构建生产包**

```bash
npm run tauri build
```

**Step 5: 最终提交**

```bash
git add .
git commit -m "feat: complete OpenClaw Node v0.1.0 initial implementation"
```

---

## 后续迭代计划（v0.2+）

- [ ] Sidecar 实现 Playwright 浏览器实际操作
- [ ] Sidecar 实现系统命令安全执行
- [ ] Tauri 任务调度器完整实现（approval_queue.rs）
- [ ] Analytics 页面图表展示
- [ ] 托盘图标根据连接状态动态变色
- [ ] 应用自动更新（tauri-plugin-updater）
- [ ] 审批弹窗独立 Notification 窗口

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

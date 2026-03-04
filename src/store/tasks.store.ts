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

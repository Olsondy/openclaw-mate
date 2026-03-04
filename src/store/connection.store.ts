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

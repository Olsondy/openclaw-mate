import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Capabilities, ApprovalRules, NodeRuntimeConfig, UserProfile } from '../types'

/** 持久化至本地的设置（仅 licenseKey） */
interface PersistedSettings {
  licenseKey: string
}

interface ConfigState {
  /** 持久化：用户的 License Key */
  licenseKey: string

  /** 内存中：节点运行时配置（来自服务端 verify 接口，不持久化） */
  runtimeConfig: NodeRuntimeConfig | null

  /** 内存中：用户授权信息（来自服务端 verify 接口，不持久化） */
  userProfile: UserProfile | null

  capabilities: Capabilities
  approvalRules: ApprovalRules

  licenseId: number | null
  authToken: string | null
  tenantUrl: string

  setLicenseKey: (key: string) => void
  setRuntimeConfig: (config: NodeRuntimeConfig) => void
  setUserProfile: (profile: UserProfile) => void
  clearSession: () => void
  toggleCapability: (key: keyof Capabilities) => void
  setApprovalRule: (key: keyof ApprovalRules, mode: ApprovalRules[keyof ApprovalRules]) => void
  setSessionMeta: (meta: { licenseId: number; authToken: string; tenantUrl: string }) => void
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

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      licenseKey: '',
      runtimeConfig: null,
      userProfile: null,
      capabilities: defaultCapabilities,
      approvalRules: defaultApprovalRules,
      licenseId: null,
      authToken: null,
      tenantUrl: '',

      setLicenseKey: (licenseKey) => set({ licenseKey }),

      setRuntimeConfig: (runtimeConfig) => set({ runtimeConfig }),

      setUserProfile: (userProfile) => set({ userProfile }),

      /** 清除内存中的 Session（但保留 licenseKey） */
      clearSession: () => set({ runtimeConfig: null, userProfile: null, licenseId: null, authToken: null }),

      toggleCapability: (key) =>
        set((state) => ({
          capabilities: { ...state.capabilities, [key]: !state.capabilities[key] },
        })),

      setApprovalRule: (key, mode) =>
        set((state) => ({
          approvalRules: { ...state.approvalRules, [key]: mode },
        })),

      setSessionMeta: ({ licenseId, authToken, tenantUrl }) =>
        set({ licenseId, authToken, tenantUrl }),
    }),
    {
      name: 'easy-openclaw-settings',
      // 只将 licenseKey、capabilities、approvalRules 写入本地存储，
      // runtimeConfig 和 userProfile 不持久化，保障 Token 隐私
      partialize: (state): PersistedSettings => ({
        licenseKey: state.licenseKey,
      }),
    }
  )
)

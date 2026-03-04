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

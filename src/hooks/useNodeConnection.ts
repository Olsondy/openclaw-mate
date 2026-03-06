import { useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useConnectionStore, useConfigStore, useBootstrapStore } from '../store'
import { useTauriEvent } from './useTauri'
import type { VerifyResponse } from '../types'

// TODO: 服务端就绪后，在 verifyAndConnect 中启用以下 fetch 调用
// POST https://api.openclaw.example.com/v1/verify
// body: { licenseKey, machineId }

export function useNodeConnection() {
  const { setStatus, setError } = useConnectionStore()
  const { licenseKey, setRuntimeConfig, setUserProfile, setSessionMeta } = useConfigStore()
  const { setNeeds } = useBootstrapStore()

  useTauriEvent('ws:connected', useCallback(() => setStatus('online'), [setStatus]))
  useTauriEvent('ws:disconnected', useCallback(() => setStatus('idle'), [setStatus]))
  useTauriEvent<string>('ws:error', useCallback((msg) => setError(msg), [setError]))

  /**
   * 使用 License Key 调用服务端 verify 接口，获取运行时配置和 Token，
   * 然后自动连接 Gateway WebSocket。
   * Token 不保存到本地，仅存于内存（runtimeConfig）。
   */
  const verifyAndConnect = useCallback(async () => {
    if (!licenseKey.trim()) {
      setError('请先输入 License Key')
      return
    }

    try {
      setStatus('auth_checking')

      const machineId = await getMachineId()

      // --- 占位：待服务端完成后，以下 mock 替换为真实 fetch 调用 ---
      // const resp = await fetch(VERIFY_ENDPOINT, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ licenseKey, machineId }),
      // })
      // const result: VerifyResponse = await resp.json()

      // Mock 响应（开发阶段使用）
      const result: VerifyResponse = await mockVerify(licenseKey, machineId)
      // --- 占位结束 ---

      if (!result.success) {
        setStatus('unauthorized')
        setError('License Key 无效或已过期，请检查后重试')
        return
      }

      const { nodeConfig, userProfile } = result.data

      if (userProfile.licenseStatus !== 'Valid') {
        setStatus('unauthorized')
        setError(`授权状态异常：${userProfile.licenseStatus}，到期日：${userProfile.expiryDate}`)
        return
      }

      // 将服务端返回的配置写入内存 store（不持久化）
      setRuntimeConfig(nodeConfig)
      setUserProfile(userProfile)

      if (nodeConfig.licenseId && nodeConfig.authToken) {
        setSessionMeta({
          licenseId: nodeConfig.licenseId,
          authToken: nodeConfig.authToken,
          tenantUrl: nodeConfig.tenantUrl ?? '',
        })
      }

      if (result.data.needsBootstrap) {
        setNeeds(result.data.needsBootstrap)
      }

      setStatus('connecting')

      // 使用内存中的 Token 和 Gateway 地址连接
      await invoke('connect_gateway', {
        gatewayUrl: nodeConfig.gatewayWsUrl,
        token: nodeConfig.gatewayToken,
        agentId: nodeConfig.agentId,
        deviceName: nodeConfig.deviceName,
      })
    } catch (e) {
      setError(String(e))
    }
  }, [licenseKey, setStatus, setError, setRuntimeConfig, setUserProfile, setSessionMeta, setNeeds])

  return { verifyAndConnect }
}

async function getMachineId(): Promise<string> {
  let id = localStorage.getItem('machine_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('machine_id', id)
  }
  return id
}

/** 开发阶段的 Mock 验证函数，服务端就绪后删除 */
async function mockVerify(licenseKey: string, machineId: string): Promise<VerifyResponse> {
  // 模拟网络延迟
  await new Promise((resolve) => setTimeout(resolve, 800))

  if (!licenseKey || licenseKey.length < 4) {
    return { success: false, data: { nodeConfig: {} as never, userProfile: {} as never } }
  }

  return {
    success: true,
    data: {
      nodeConfig: {
        gatewayWsUrl: 'ws://your-cloud-api.com:18789',
        gatewayWebUI: 'http://your-web-ui.com:18789',
        gatewayToken: `mock-token-${machineId.slice(0, 8)}`,
        agentId: machineId,
        deviceName: 'My Device',
      },
      userProfile: {
        licenseStatus: 'Valid',
        expiryDate: '2027-01-01',
      },
    },
  }
}

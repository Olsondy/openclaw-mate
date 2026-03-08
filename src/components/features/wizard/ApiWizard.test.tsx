import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ApiWizard } from './ApiWizard'
import { useConfigStore } from '../../../store'

const invokeMock = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}))

describe('ApiWizard', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    useConfigStore.setState({
      licenseKey: 'LIC-001',
      runtimeConfig: null,
      userProfile: null,
      capabilities: { browser: true, system: false, vision: true },
      approvalRules: { browser: 'sensitive_only', system: 'always', vision: 'never' },
      licenseId: 1,
    })
  })

  it('submits modelAuth payload with tenant contract fields', async () => {
    invokeMock.mockResolvedValue({ device_id: 'device-001' })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { applied: ['modelAuth'] } }),
    } as Response)

    const onSuccess = vi.fn()
    render(<ApiWizard licenseId={1} onSuccess={onSuccess} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('模型供应商'), { target: { value: 'openai' } })
    fireEvent.change(screen.getByLabelText('模型 ID'), { target: { value: 'gpt-4o-mini' } })
    fireEvent.change(screen.getByLabelText('模型名称'), { target: { value: 'GPT-4o mini' } })
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test' } })
    fireEvent.click(screen.getByRole('button', { name: '提交' }))

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse((init as RequestInit).body as string) as {
      licenseKey: string
      hwid: string
      modelAuth: { providerId: string; modelId: string; modelName: string; apiKey: string }
    }
    expect(body.licenseKey).toBe('LIC-001')
    expect(body.hwid).toBe('device-001')
    expect(body.modelAuth.providerId).toBe('openai')
    expect(body.modelAuth.modelId).toBe('gpt-4o-mini')
    expect(body.modelAuth.modelName).toBe('GPT-4o mini')
    expect(body.modelAuth.apiKey).toBe('sk-test')

    fetchMock.mockRestore()
  })
})

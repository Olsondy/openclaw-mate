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

import { executeBrowser, closeBrowser } from './browser'
import type { SidecarTask } from '../types'

const makeTask = (command: string, args: Record<string, unknown>): SidecarTask => ({
  task_id: 'test-1',
  type: 'browser',
  payload: { command, ...args },
  timeout_ms: 30000,
})

describe('browser module', () => {
  afterAll(async () => {
    await closeBrowser()
  })

  it('navigates to a URL and returns title', async () => {
    const result = await executeBrowser(makeTask('browser.navigate', { url: 'https://example.com' }))
    expect(result.status).toBe('success')
    expect(result.result).toHaveProperty('title')
    expect(result.result).toHaveProperty('url')
  }, 30000)

  it('takes a screenshot and returns base64', async () => {
    await executeBrowser(makeTask('browser.navigate', { url: 'https://example.com' }))
    const result = await executeBrowser(makeTask('browser.screenshot', {}))
    expect(result.status).toBe('success')
    expect(typeof result.result).toBe('string')
    expect((result.result as string).length).toBeGreaterThan(100)
  }, 30000)

  it('returns error for unknown command', async () => {
    const result = await executeBrowser(makeTask('browser.unknown', {}))
    expect(result.status).toBe('error')
  }, 10000)
})

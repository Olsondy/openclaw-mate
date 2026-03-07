import { executeVision } from './vision'
import type { SidecarTask } from '../types'

const makeTask = (command: string): SidecarTask => ({
  task_id: 'v-test-1',
  type: 'vision',
  payload: { command },
  timeout_ms: 15000,
})

describe('vision module', () => {
  it('takes a full-page screenshot and returns base64', async () => {
    const result = await executeVision(makeTask('vision.screenshot'))
    expect(result.status).toBe('success')
    expect(typeof result.result).toBe('string')
    expect((result.result as string).length).toBeGreaterThan(100)
  }, 15000)

  it('returns error for unknown command', async () => {
    const result = await executeVision(makeTask('vision.unknown'))
    expect(result.status).toBe('error')
    expect(result.error).toContain('vision.unknown')
  })
})

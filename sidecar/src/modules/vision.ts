import { chromium } from 'playwright'
import type { SidecarTask, SidecarResult } from '../types'

export async function executeVision(task: SidecarTask): Promise<SidecarResult> {
  const logs: string[] = []
  const command = String(task.payload?.command ?? '')

  try {
    switch (command) {
      case 'vision.screenshot': {
        const browser = await chromium.launch({ headless: true })
        try {
          const page = await browser.newPage()
          await page.setViewportSize({ width: 1280, height: 800 })
          const buffer = await page.screenshot({ type: 'png', fullPage: true })
          const base64 = buffer.toString('base64')
          logs.push('[vision] screenshot captured')
          return { task_id: task.task_id, status: 'success', result: base64, logs }
        } finally {
          await browser.close()
        }
      }

      default:
        return { task_id: task.task_id, status: 'error', error: `Unknown vision command: ${command}`, logs }
    }
  } catch (e) {
    return { task_id: task.task_id, status: 'error', error: String(e), logs }
  }
}

import { chromium, type Browser, type Page } from 'playwright'
import type { SidecarTask, SidecarResult } from '../types'

let browserPromise: Promise<Browser> | null = null
let page: Page | null = null

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true })
  }
  return browserPromise
}

async function getPage(): Promise<Page> {
  const b = await getBrowser()
  if (!page || page.isClosed()) {
    page = await b.newPage()
  }
  return page
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise
    await b.close()
    browserPromise = null
    page = null
  }
}

export async function executeBrowser(task: SidecarTask): Promise<SidecarResult> {
  const logs: string[] = []
  const command = task.payload.command as string

  try {
    const p = await getPage()

    switch (command) {
      case 'browser.navigate': {
        const url = task.payload.url
        if (typeof url !== 'string' || !url) {
          return { task_id: task.task_id, status: 'error', error: 'Missing required field: url', logs }
        }
        await p.goto(url, { waitUntil: 'domcontentloaded' })
        const title = await p.title()
        logs.push(`[browser] navigated to ${url}`)
        return { task_id: task.task_id, status: 'success', result: { title, url: p.url() }, logs }
      }

      case 'browser.screenshot': {
        const buffer = await p.screenshot({ type: 'png' })
        const base64 = buffer.toString('base64')
        logs.push('[browser] screenshot taken')
        return { task_id: task.task_id, status: 'success', result: base64, logs }
      }

      case 'browser.click': {
        const selector = task.payload.selector
        if (typeof selector !== 'string' || !selector) {
          return { task_id: task.task_id, status: 'error', error: 'Missing required field: selector', logs }
        }
        await p.click(selector)
        logs.push(`[browser] clicked ${selector}`)
        return { task_id: task.task_id, status: 'success', result: null, logs }
      }

      case 'browser.type': {
        const selector = task.payload.selector
        const text = task.payload.text
        if (typeof selector !== 'string' || !selector) {
          return { task_id: task.task_id, status: 'error', error: 'Missing required field: selector', logs }
        }
        if (typeof text !== 'string') {
          return { task_id: task.task_id, status: 'error', error: 'Missing required field: text', logs }
        }
        await p.fill(selector, text)
        logs.push(`[browser] typed into ${selector}`)
        return { task_id: task.task_id, status: 'success', result: null, logs }
      }

      default:
        return { task_id: task.task_id, status: 'error', error: `Unknown browser command: ${command}`, logs }
    }
  } catch (e) {
    return { task_id: task.task_id, status: 'error', error: String(e), logs }
  }
}

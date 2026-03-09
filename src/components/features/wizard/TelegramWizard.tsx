import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { Button, Card } from '../../ui'
import { useConfigStore } from '../../../store'

const TENANT_API_BASE = import.meta.env.VITE_TENANT_API_BASE ?? ''

interface Props {
  licenseId: number
  onSuccess: () => void
  onClose: () => void
}

export function TelegramWizard({ licenseId, onSuccess, onClose }: Props) {
  const { licenseKey } = useConfigStore()
  const [botToken, setBotToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canSubmit = botToken.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const identity = await invoke<{ device_id: string }>('get_device_identity')
      const res = await fetch(`${TENANT_API_BASE}/api/licenses/${licenseId}/bootstrap-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licenseKey,
          hwid: identity.device_id,
          telegram: { botToken: botToken.trim() },
        }),
      })
      const body = await res.json()
      if (!res.ok || !body.success) {
        setError(body.error ?? '提交失败，请重试')
        return
      }
      onSuccess()
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 text-sm rounded-lg border border-outline bg-surface text-surface-on focus:outline-none focus:ring-2 focus:ring-primary/50'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <Send size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-surface-on">Telegram 配置向导</h2>
        </div>
        <p className="text-xs text-surface-on-variant mb-4">
          请填写 Telegram Bot Token，配置完成后即可通过 Telegram 与 AI 交互。
          可前往 <span className="font-mono text-primary">@BotFather</span> 创建 Bot 并获取 Token。
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-surface-on-variant mb-1 block">Bot Token</label>
            <input
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="例: 123456789:AAxxxxxx..."
              className={inputClass}
              autoComplete="off"
            />
          </div>
          {error && (
            <p className="text-xs text-error-on-container bg-error-container p-2 rounded-lg">{error}</p>
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="text" onClick={onClose} disabled={loading} className="flex-1">
              稍后配置
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || loading} className="flex-1">
              {loading ? <Loader2 size={14} className="animate-spin" /> : '提交'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

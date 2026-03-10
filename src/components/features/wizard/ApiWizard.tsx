import { useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Cpu, Loader2 } from 'lucide-react'
import { Button, Card } from '../../ui'
import { useConfigStore } from '../../../store'

const TENANT_API_BASE = import.meta.env.VITE_TENANT_API_BASE ?? ''

interface Props {
  licenseId: number
  onSuccess: () => void
  onClose: () => void
}

const PROVIDERS = [
  {
    id: 'zai',
    label: 'Zhipu AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    api: 'openai-completions',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    api: 'openai-completions',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    api: 'anthropic-messages',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    api: 'openai-completions',
  },
]

export function ApiWizard({ licenseId, onSuccess, onClose }: Props) {
  const { licenseKey } = useConfigStore()
  const [providerId, setProviderId] = useState('')
  const [modelId, setModelId] = useState('')
  const [modelName, setModelName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const provider = useMemo(() => PROVIDERS.find((p) => p.id === providerId) ?? null, [providerId])
  const canSubmit = !!provider && modelId.trim() && modelName.trim() && apiKey.trim()

  const handleSubmit = async () => {
    if (!provider || !canSubmit) return
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
          modelAuth: {
            providerId: provider.id,
            providerLabel: provider.label,
            baseUrl: provider.baseUrl,
            api: provider.api,
            modelId: modelId.trim(),
            modelName: modelName.trim(),
            apiKey: apiKey.trim(),
          },
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
    'w-full px-3 py-2 text-sm rounded-lg border border-white/15 bg-surface-variant text-surface-on placeholder:text-surface-on-variant/60 focus:outline-none focus:ring-1 focus:ring-white/20'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center gap-2 mb-4">
          <Cpu size={16} className="text-primary" />
          <h2 className="text-sm font-semibold text-surface-on">模型 API 配置向导</h2>
        </div>
        <p className="text-xs text-surface-on-variant mb-4">
          该配置会覆盖 license 初始写入的模型配置，仅写入节点文件，不保存到租户服务数据库。
        </p>

        <div className="space-y-3">
          <div>
            <label htmlFor="api-provider" className="text-xs text-surface-on-variant mb-1 block">
              模型供应商
            </label>
            <select
              id="api-provider"
              className={inputClass}
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
            >
              <option value="">请选择供应商</option>
              {PROVIDERS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="api-model-id" className="text-xs text-surface-on-variant mb-1 block">
              模型 ID
            </label>
            <input
              id="api-model-id"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="例如: glm-4.7-flash"
              className={inputClass}
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="api-model-name" className="text-xs text-surface-on-variant mb-1 block">
              模型名称
            </label>
            <input
              id="api-model-name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="例如: GLM-4.7 Flash"
              className={inputClass}
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="api-key" className="text-xs text-surface-on-variant mb-1 block">
              API Key
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className={inputClass}
              autoComplete="off"
            />
          </div>

          <div className="text-[11px] text-surface-on-variant">
            <div>Base URL: {provider?.baseUrl ?? '-'}</div>
            <div>协议: {provider?.api ?? '-'}</div>
          </div>

          {error && (
            <p className="text-xs text-error-on-container bg-error-container p-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="text" onClick={onClose} disabled={loading} className="flex-1">
              取消
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

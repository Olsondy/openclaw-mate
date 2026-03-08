import { useState } from 'react'
import { KeyRound, CheckCircle, AlertCircle, Loader2, ExternalLink, Shield, MessageSquare } from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { Card, Button } from '../components/ui'
import { useConfigStore, useConnectionStore, useBootstrapStore } from '../store'
import { useNodeConnection } from '../hooks/useNodeConnection'
import { ApiWizard } from '../components/features/wizard/ApiWizard'

export function SettingsPage() {
  const { licenseKey, setLicenseKey, userProfile, runtimeConfig, approvalRules, setApprovalRule, licenseId } = useConfigStore()
  const { status, errorMessage } = useConnectionStore()
  const { verifyAndConnect } = useNodeConnection()
  const { openWizard } = useBootstrapStore()

  const [localKey, setLocalKey] = useState(licenseKey)
  const [apiWizardOpen, setApiWizardOpen] = useState(false)

  const isLoading = status === 'auth_checking' || status === 'connecting'
  const isOnline = status === 'online'

  const handleActivate = async () => {
    setLicenseKey(localKey)
    await verifyAndConnect()
  }

  const inputClass =
    'w-full px-3 py-2 text-sm rounded-lg border border-outline bg-surface text-surface-on focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono tracking-wider'

  return (
    <>
      <TopBar title="Settings" subtitle="激活与配置" />
      <div className="flex-1 overflow-auto p-6 space-y-4 max-w-2xl">

        {/* License 激活卡片 */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <KeyRound size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-surface-on">License 激活</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-surface-on-variant mb-1 block">License Key</label>
              <input
                type="password"
                value={localKey}
                onChange={(e) => setLocalKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className={inputClass}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-error-container text-error-on-container text-sm">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              onClick={handleActivate}
              disabled={isLoading || !localKey.trim()}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {status === 'auth_checking' ? '验证中...' : '连接中...'}
                </span>
              ) : isOnline ? '重新验证' : '验证并激活'}
            </Button>
          </div>
        </Card>

        {/* 激活状态卡片（仅激活后显示） */}
        {isOnline && userProfile && runtimeConfig && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={16} className="text-green-500" />
              <h2 className="text-sm font-semibold text-surface-on">节点状态</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-on-variant">授权状态</span>
                <span className="text-green-500 font-medium">{userProfile.licenseStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-on-variant">到期日期</span>
                <span className="text-surface-on">{userProfile.expiryDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-on-variant">设备名</span>
                <span className="text-surface-on font-mono">{runtimeConfig.deviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-on-variant">Agent ID</span>
                <span className="text-surface-on font-mono text-xs truncate max-w-[200px]">{runtimeConfig.agentId}</span>
              </div>
              {runtimeConfig.gatewayWebUI && (
                <div className="flex justify-between items-center">
                  <span className="text-surface-on-variant">Cloud 控制台</span>
                  <a
                    href={runtimeConfig.gatewayWebUI}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary text-xs hover:underline"
                  >
                    打开 <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* 飞书配置卡片（激活后始终显示） */}
        {isOnline && licenseId && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-surface-on">飞书配置</h2>
            </div>
            <p className="text-xs text-surface-on-variant mb-3">
              配置飞书 App ID 和 App Secret，以启用飞书消息通道。
            </p>
            <Button variant="outlined" onClick={openWizard}>
              配置飞书
            </Button>
          </Card>
        )}

        {isOnline && licenseId && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <KeyRound size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-surface-on">模型 API 配置</h2>
            </div>
            <p className="text-xs text-surface-on-variant mb-3">
              手动覆盖节点当前模型配置，不会写回租户服务数据库。
            </p>
            <Button variant="outlined" onClick={() => setApiWizardOpen(true)}>
              打开配置向导
            </Button>
          </Card>
        )}

        {/* 审批规则卡片 */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-surface-on">审批规则</h2>
          </div>
          <div className="space-y-3">
            {(['browser', 'system', 'vision'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-surface-on capitalize">{key}</span>
                <select
                  value={approvalRules[key]}
                  onChange={(e) => setApprovalRule(key, e.target.value as 'always' | 'never' | 'sensitive_only')}
                  className="text-sm px-2 py-1 rounded-lg border border-outline bg-surface text-surface-on"
                >
                  <option value="always">总是询问</option>
                  <option value="sensitive_only">敏感操作询问</option>
                  <option value="never">不询问</option>
                </select>
              </div>
            ))}
          </div>
        </Card>

      </div>
      {apiWizardOpen && licenseId && (
        <ApiWizard
          licenseId={licenseId}
          onSuccess={() => {
            setApiWizardOpen(false)
            verifyAndConnect()
          }}
          onClose={() => setApiWizardOpen(false)}
        />
      )}
    </>
  )
}

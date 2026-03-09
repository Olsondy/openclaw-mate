import { useState } from 'react'
import { KeyRound, CheckCircle, AlertCircle, Loader2, ExternalLink, Shield, MessageSquare, TriangleAlert, Palette, Languages, Sun, Moon, Monitor } from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { Card, Button } from '../components/ui'
import { useConfigStore, useConnectionStore, useBootstrapStore } from '../store'
import { useNodeConnection } from '../hooks/useNodeConnection'
import { LocalConnectPanel } from '../components/features/settings/LocalConnectPanel'
import { ApiWizard } from '../components/features/wizard/ApiWizard'

type ConnectionMode = 'license' | 'local'
import { useT, useI18nStore } from '../i18n'
import type { Locale, Theme } from '../i18n'

function maskLicenseKey(key: string): string {
  const parts = key.split('-')
  if (parts.length === 4) {
    return `${parts[0]}-****-****-${parts[3]}`
  }
  return `${key.slice(0, 4)}****`
}

const THEMES: { key: Theme; labelKey: 'themeLight' | 'themeDark' | 'themeSystem'; icon: React.ElementType }[] = [
  { key: 'light', labelKey: 'themeLight', icon: Sun },
  { key: 'dark', labelKey: 'themeDark', icon: Moon },
  { key: 'system', labelKey: 'themeSystem', icon: Monitor },
]

export function SettingsPage() {
  const { licenseKey, expiryDate, setLicenseKey, userProfile, runtimeConfig, approvalRules, setApprovalRule, licenseId } = useConfigStore()
  const { status, errorMessage } = useConnectionStore()
  const { verifyAndConnect } = useNodeConnection()
  const { openWizard } = useBootstrapStore()
  const t = useT()
  const { locale, theme, setLocale, setTheme } = useI18nStore()

  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('license')
  const [isChangingKey, setIsChangingKey] = useState(!licenseKey)
  const [newKey, setNewKey] = useState('')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [apiWizardOpen, setApiWizardOpen] = useState(false)

  const isLoading = status === 'auth_checking' || status === 'connecting'
  const isOnline = status === 'online'
  const hasKey = Boolean(licenseKey)

  const handleRequestChange = () => {
    setNewKey('')
    setIsChangingKey(true)
  }

  const handleCancel = () => {
    setNewKey('')
    setIsChangingKey(false)
  }

  const handleActivateOrConfirm = () => {
    if (hasKey) {
      setShowConfirmDialog(true)
    } else {
      doActivate()
    }
  }

  const doActivate = async () => {
    setShowConfirmDialog(false)
    setLicenseKey(newKey.trim())
    setIsChangingKey(false)
    await verifyAndConnect()
  }

  const inputClass =
    'w-full px-3 py-2 text-sm rounded-lg border border-outline bg-surface text-surface-on focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono tracking-wider'

  return (
    <>
      <TopBar title={t.sidebar.settings} subtitle={t.topbar.settingsSub} />
      <div className="flex-1 overflow-auto p-6 space-y-4 max-w-2xl">

        {/* 外观卡片 */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-surface-on">{t.settings.appearance}</h2>
          </div>

          {/* 语言切换 */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <Languages size={13} className="text-surface-on-variant" />
              <span className="text-xs text-surface-on-variant">{t.settings.language}</span>
            </div>
            <div className="flex gap-2">
              {(['zh', 'en'] as Locale[]).map((loc) => (
                <button
                  key={loc}
                  onClick={() => setLocale(loc)}
                  className={`px-4 py-1.5 text-sm rounded-lg border transition-all ${locale === loc
                    ? 'border-primary bg-primary/5 text-primary font-medium'
                    : 'border-outline text-surface-on-variant hover:border-primary/40 hover:text-surface-on'
                    }`}
                >
                  {loc === 'zh' ? '中文' : 'English'}
                </button>
              ))}
            </div>
          </div>

          {/* 主题色切换 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sun size={13} className="text-surface-on-variant" />
              <span className="text-xs text-surface-on-variant">{t.settings.themeColor}</span>
            </div>
            <div className="flex gap-2">
              {THEMES.map(({ key, labelKey, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  className={`flex items-center gap-2 px-4 py-1.5 text-sm rounded-lg border transition-all ${theme === key
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-outline text-surface-on-variant hover:border-primary/40 hover:text-surface-on'
                    }`}
                >
                  <Icon size={14} />
                  {t.settings[labelKey]}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* License 激活卡片 */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <KeyRound size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-surface-on">{t.settings.licenseActivation}</h2>
          </div>

          {/* 模式 Tab */}
          <div className="flex border-b border-outline/20 mb-4 -mx-1">
            {(['license', 'local'] as ConnectionMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setConnectionMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  connectionMode === mode
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-surface-on-variant hover:text-surface-on'
                }`}
              >
                {mode === 'license' ? t.settings.licenseKeyLabel : t.settings.localOpenClaw}
              </button>
            ))}
          </div>

          {connectionMode === 'local' ? (
            <LocalConnectPanel />
          ) : (
          <div className="space-y-3">
            {hasKey && (
              <div className="rounded-lg border border-surface-variant bg-surface-variant/30 px-3 py-2.5 space-y-1.5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-on-variant">{t.settings.currentKey}</span>
                  <span className="font-mono text-surface-on tracking-wider">{maskLicenseKey(licenseKey)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-on-variant">{t.settings.expiry}</span>
                  <span className="text-surface-on">
                    {expiryDate === 'Permanent' || !expiryDate ? t.settings.permanent : expiryDate}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-surface-on-variant">{t.settings.authStatus}</span>
                  <span className={isOnline ? 'text-green-500 font-medium' : 'text-surface-on-variant'}>
                    {isOnline ? t.settings.activated : t.settings.notConnected}
                  </span>
                </div>
              </div>
            )}

            {isChangingKey ? (
              <>
                <div>
                  <label className="text-xs text-surface-on-variant mb-1 block">
                    {hasKey ? t.settings.newKey : t.settings.licenseKeyLabel}
                  </label>
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
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

                <div className="flex gap-2">
                  {hasKey && (
                    <Button variant="outlined" onClick={handleCancel} disabled={isLoading}>
                      {t.settings.cancel}
                    </Button>
                  )}
                  <Button
                    onClick={handleActivateOrConfirm}
                    disabled={isLoading || !newKey.trim()}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        {status === 'auth_checking' ? t.settings.verifying : t.settings.connecting}
                      </span>
                    ) : t.settings.verifyAndActivate}
                  </Button>
                </div>
              </>
            ) : (
              <Button variant="outlined" onClick={handleRequestChange} className="w-full">
                {t.settings.changeKey}
              </Button>
            )}
          </div>
          )}
        </Card>

        {/* 激活状态卡片 */}
        {isOnline && userProfile && runtimeConfig && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={16} className="text-green-500" />
              <h2 className="text-sm font-semibold text-surface-on">{t.settings.nodeStatus}</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-on-variant">{t.settings.authStatusLabel}</span>
                <span className="text-green-500 font-medium">{userProfile.licenseStatus}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-on-variant">{t.settings.expiryDate}</span>
                <span className="text-surface-on">{userProfile.expiryDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-on-variant">{t.settings.deviceName}</span>
                <span className="text-surface-on font-mono">{runtimeConfig.deviceName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-on-variant">{t.settings.agentId}</span>
                <span className="text-surface-on font-mono text-xs truncate max-w-[200px]">{runtimeConfig.agentId}</span>
              </div>
              {runtimeConfig.gatewayWebUI && (
                <div className="flex justify-between items-center">
                  <span className="text-surface-on-variant">{t.settings.cloudConsole}</span>
                  <a
                    href={runtimeConfig.gatewayWebUI}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary text-xs hover:underline"
                  >
                    {t.settings.open} <ExternalLink size={11} />
                  </a>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* 飞书配置卡片 */}
        {isOnline && licenseId && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-surface-on">{t.settings.feishuConfig}</h2>
            </div>
            <p className="text-xs text-surface-on-variant mb-3">
              {t.settings.feishuConfigDesc}
            </p>
            <Button variant="outlined" onClick={openWizard}>
              {t.settings.configureFeishu}
            </Button>
          </Card>
        )}

        {/* 模型 API 配置卡片 */}
        <div className="relative">
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <KeyRound size={16} className="text-primary" />
              <h2 className="text-sm font-semibold text-surface-on">{t.settings.apiConfig}</h2>
            </div>
            <p className="text-xs text-surface-on-variant mb-3">
              {t.settings.apiConfigDesc}
            </p>
            <Button variant="outlined" onClick={() => setApiWizardOpen(true)}>
              {t.settings.openWizard}
            </Button>
          </Card>
          {!licenseId && (
            <div className="absolute inset-0 bg-surface/75 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
              <p className="text-sm text-surface-on-variant font-medium">{t.settings.activateFirst}</p>
            </div>
          )}
        </div>

        {/* 审批规则卡片 */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-surface-on">{t.settings.approvalRules}</h2>
          </div>
          <div className="space-y-3">
            {(['browser', 'system', 'vision'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-surface-on">{key === 'browser' ? t.settings.approvalBrowser : key === 'system' ? t.settings.approvalSystem : t.settings.approvalVision}</span>
                <select
                  value={approvalRules[key]}
                  onChange={(e) => setApprovalRule(key, e.target.value as 'always' | 'never' | 'sensitive_only')}
                  className="text-sm px-2 py-1 rounded-lg border border-outline bg-surface text-surface-on"
                >
                  <option value="always">{t.settings.always}</option>
                  <option value="sensitive_only">{t.settings.sensitiveOnly}</option>
                  <option value="never">{t.settings.never}</option>
                </select>
              </div>
            ))}
          </div>
        </Card>

      </div>

      {/* 换 Key 二次确认弹窗 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface rounded-2xl shadow-elevation-3 p-6 w-80 space-y-4">
            <div className="flex items-center gap-2 text-warning">
              <TriangleAlert size={18} />
              <h3 className="text-sm font-semibold text-surface-on">{t.settings.confirmChangeKey}</h3>
            </div>
            <p className="text-sm text-surface-on-variant leading-relaxed">
              {t.settings.confirmChangeDesc}
            </p>
            <ul className="text-sm text-surface-on space-y-1.5 pl-1">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-surface-on-variant">•</span>
                <span>{t.settings.confirmBullet1}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-surface-on-variant">•</span>
                <span>{t.settings.confirmBullet2}</span>
              </li>
            </ul>
            <p className="text-xs text-error font-medium">{t.settings.irreversible}</p>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outlined"
                className="flex-1"
                onClick={() => setShowConfirmDialog(false)}
              >
                {t.settings.cancel}
              </Button>
              <Button
                className="flex-1 bg-error text-white hover:bg-error/90"
                onClick={doActivate}
              >
                {t.settings.confirmChange}
              </Button>
            </div>
          </div>
        </div>
      )}

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

import { useState } from 'react'
import {
  KeyRound, CheckCircle, AlertCircle, Loader2, ExternalLink,
  Shield, MessageSquare, TriangleAlert, Palette, Languages,
  Sun, Moon, Monitor, ArrowLeftRight, Cpu, ArrowRight,
} from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { Card, Button } from '../components/ui'
import { useConfigStore, useConnectionStore, useBootstrapStore } from '../store'
import { useNodeConnection } from '../hooks/useNodeConnection'
import { LocalConnectPanel } from '../components/features/settings/LocalConnectPanel'
import { SwitchModeDialog } from '../components/features/settings/SwitchModeDialog'
import { ApiWizard } from '../components/features/wizard/ApiWizard'
import { useT, useI18nStore } from '../i18n'
import type { Locale, Theme } from '../i18n'
import type { ConnectionMode } from '../store/config.store'

function maskLicenseKey(key: string): string {
  const parts = key.split('-')
  if (parts.length === 4) return `${parts[0]}-****-****-${parts[3]}`
  return `${key.slice(0, 4)}****`
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold text-surface-on-variant uppercase tracking-wider px-1 mb-2">
      {title}
    </h2>
  )
}

const THEMES: { key: Theme; label: string; icon: React.ElementType }[] = [
  { key: 'light', label: '浅色', icon: Sun },
  { key: 'dark', label: '深色', icon: Moon },
  { key: 'system', label: '跟随系统', icon: Monitor },
]

const MODE_LABEL: Record<ConnectionMode, string> = {
  license: 'License 云端',
  local: '本地 OpenClaw',
}

export function SettingsPage() {
  const {
    licenseKey, expiryDate, setLicenseKey,
    userProfile, runtimeConfig, approvalRules, setApprovalRule,
    licenseId, connectionMode, setConnectionMode,
  } = useConfigStore()
  const { status, errorMessage } = useConnectionStore()
  const { verifyAndConnect } = useNodeConnection()
  const { openWizard } = useBootstrapStore()
  const t = useT()
  const { locale, theme, setLocale, setTheme } = useI18nStore()

  const [isChangingKey, setIsChangingKey] = useState(!licenseKey)
  const [newKey, setNewKey] = useState('')
  const [showConfirmKey, setShowConfirmKey] = useState(false)
  const [apiWizardOpen, setApiWizardOpen] = useState(false)
  const [switchTarget, setSwitchTarget] = useState<ConnectionMode | null>(null)

  const isLoading = status === 'auth_checking' || status === 'connecting'
  const isOnline = status === 'online'
  const hasKey = Boolean(licenseKey)

  const doActivate = async () => {
    setShowConfirmKey(false)
    setLicenseKey(newKey.trim())
    setIsChangingKey(false)
    await verifyAndConnect()
  }

  const handleSwitchConfirm = (toMode: ConnectionMode) => {
    setConnectionMode(toMode)
    setSwitchTarget(null)
  }

  const inputClass =
    'w-full px-3 py-2 text-sm rounded-lg border border-white/15 bg-surface-variant text-surface-on placeholder:text-surface-on-variant/60 focus:outline-none focus:ring-1 focus:ring-white/20 font-mono tracking-wider'

  const selectClass =
    'text-sm px-2 py-1 rounded-lg border border-white/15 bg-surface-variant text-surface-on focus:outline-none'

  return (
    <>
      <TopBar title={t.sidebar.settings} subtitle={t.topbar.settingsSub} />
      <div className="flex-1 overflow-auto p-6 space-y-6 max-w-2xl">

        {/* ── 连接方式 ── */}
        <section>
          <SectionHeader title="连接方式" />

          {/* 当前模式 + 切换 */}
          <Card className="mb-3">
            {connectionMode ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-surface-on-variant mb-0.5">当前模式</div>
                  <div className="text-sm font-medium text-surface-on">{MODE_LABEL[connectionMode]}</div>
                </div>
                <Button
                  variant="outlined"
                  size="sm"
                  onClick={() => setSwitchTarget(connectionMode === 'license' ? 'local' : 'license')}
                >
                  <ArrowLeftRight size={13} className="mr-1.5" />
                  切换到 {connectionMode === 'license' ? '本地' : 'License'}
                </Button>
              </div>
            ) : (
              <div>
                <div className="text-xs text-surface-on-variant mb-3">选择连接方式</div>
                <div className="flex gap-2">
                  {(['license', 'local'] as ConnectionMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={async () => {
                        const { invoke } = await import('@tauri-apps/api/core')
                        await invoke('save_app_config', { config: { connectionMode: mode } })
                        setConnectionMode(mode)
                      }}
                      className="flex-1 flex items-center justify-between px-3 py-2.5 rounded-lg border border-card-border bg-surface hover:border-white/20 transition-all text-left"
                    >
                      <span className="text-sm text-surface-on">{MODE_LABEL[mode]}</span>
                      <ArrowRight size={13} className="text-surface-on-variant" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* License 模式内容 */}
          {connectionMode === 'license' && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <KeyRound size={15} className="text-primary" />
                <span className="text-sm font-medium text-surface-on">License Key</span>
              </div>

              {hasKey && (
                <div className="rounded-lg border border-white/8 bg-surface px-3 py-2.5 space-y-1.5 mb-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-on-variant">当前 Key</span>
                    <span className="font-mono text-surface-on">{maskLicenseKey(licenseKey)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-on-variant">到期日</span>
                    <span className="text-surface-on">
                      {expiryDate === 'Permanent' || !expiryDate ? '永久' : expiryDate}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-on-variant">状态</span>
                    <span className={isOnline ? 'text-green-500 font-medium' : 'text-surface-on-variant'}>
                      {isOnline ? '已连接' : '未连接'}
                    </span>
                  </div>
                </div>
              )}

              {isChangingKey ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-surface-on-variant mb-1 block">
                      {hasKey ? '新 License Key' : 'License Key'}
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
                      <Button variant="outlined" onClick={() => { setNewKey(''); setIsChangingKey(false) }} disabled={isLoading}>
                        取消
                      </Button>
                    )}
                    <Button
                      onClick={() => hasKey ? setShowConfirmKey(true) : doActivate()}
                      disabled={isLoading || !newKey.trim()}
                      className="flex-1"
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <Loader2 size={14} className="animate-spin" />
                          {status === 'auth_checking' ? '验证中...' : '连接中...'}
                        </span>
                      ) : '验证并激活'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outlined" onClick={() => setIsChangingKey(true)} className="w-full">
                  更换 Key
                </Button>
              )}
            </Card>
          )}

          {/* 本地模式内容 */}
          {connectionMode === 'local' && (
            <Card>
              <LocalConnectPanel />
            </Card>
          )}
        </section>

        {/* ── 节点状态 ── */}
        {isOnline && userProfile && runtimeConfig && (
          <section>
            <SectionHeader title="节点状态" />
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={15} className="text-green-500" />
                <span className="text-sm font-medium text-surface-on">已连接</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-surface-on-variant">授权状态</span>
                  <span className="text-green-500 font-medium">{userProfile.licenseStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-on-variant">到期日</span>
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
                    <span className="text-surface-on-variant">控制台</span>
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
          </section>
        )}

        {/* ── 节点配置 ── */}
        <section>
          <SectionHeader title="节点配置" />

          {/* 飞书 */}
          {isOnline && licenseId && (
            <Card className="mb-3">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare size={15} className="text-primary" />
                <span className="text-sm font-medium text-surface-on">{t.settings.feishuConfig}</span>
              </div>
              <p className="text-xs text-surface-on-variant mb-3">{t.settings.feishuConfigDesc}</p>
              <Button variant="outlined" onClick={openWizard}>{t.settings.configureFeishu}</Button>
            </Card>
          )}

          {/* 模型 API */}
          <div className="relative mb-3">
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <Cpu size={15} className="text-primary" />
                <span className="text-sm font-medium text-surface-on">{t.settings.apiConfig}</span>
              </div>
              <p className="text-xs text-surface-on-variant mb-3">{t.settings.apiConfigDesc}</p>
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

          {/* 审批规则 */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <Shield size={15} className="text-primary" />
              <span className="text-sm font-medium text-surface-on">{t.settings.approvalRules}</span>
            </div>
            <div className="space-y-3">
              {(['browser', 'system', 'vision'] as const).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-surface-on">
                    {key === 'browser' ? t.settings.approvalBrowser : key === 'system' ? t.settings.approvalSystem : t.settings.approvalVision}
                  </span>
                  <select
                    value={approvalRules[key]}
                    onChange={(e) => setApprovalRule(key, e.target.value as 'always' | 'never' | 'sensitive_only')}
                    className={selectClass}
                  >
                    <option value="always">{t.settings.always}</option>
                    <option value="sensitive_only">{t.settings.sensitiveOnly}</option>
                    <option value="never">{t.settings.never}</option>
                  </select>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* ── 偏好设置 ── */}
        <section>
          <SectionHeader title="偏好设置" />
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Palette size={15} className="text-primary" />
              <span className="text-sm font-medium text-surface-on">{t.settings.appearance}</span>
            </div>

            {/* 语言 */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Languages size={13} className="text-surface-on-variant" />
                <span className="text-xs text-surface-on-variant">{t.settings.language}</span>
              </div>
              <div className="flex gap-2">
                {(['zh', 'en'] as Locale[]).map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocale(loc)}
                    className={`px-4 py-1.5 text-sm rounded-lg border transition-all ${
                      locale === loc
                        ? 'border-primary bg-primary/5 text-primary font-medium'
                        : 'border-white/15 text-surface-on-variant hover:text-surface-on'
                    }`}
                  >
                    {loc === 'zh' ? '中文' : 'English'}
                  </button>
                ))}
              </div>
            </div>

            {/* 主题 */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sun size={13} className="text-surface-on-variant" />
                <span className="text-xs text-surface-on-variant">{t.settings.themeColor}</span>
              </div>
              <div className="flex gap-2">
                {THEMES.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTheme(key)}
                    className={`flex items-center gap-2 px-4 py-1.5 text-sm rounded-lg border transition-all ${
                      theme === key
                        ? 'border-primary bg-primary/5 text-primary font-medium'
                        : 'border-white/15 text-surface-on-variant hover:text-surface-on'
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </section>

      </div>

      {/* ── 换 Key 确认弹窗 ── */}
      {showConfirmKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-card-bg border border-card-border rounded-xl shadow-2xl ring-1 ring-white/10 w-80 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <TriangleAlert size={16} className="text-yellow-500" />
              <h3 className="text-sm font-semibold text-surface-on">{t.settings.confirmChangeKey}</h3>
            </div>
            <p className="text-xs text-surface-on-variant leading-relaxed">{t.settings.confirmChangeDesc}</p>
            <ul className="text-xs text-surface-on space-y-1.5 pl-1">
              {[t.settings.confirmBullet1, t.settings.confirmBullet2].map((item) => (
                <li key={item} className="flex items-start gap-1.5">
                  <span className="mt-0.5 text-surface-on-variant">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <Button variant="outlined" className="flex-1" onClick={() => setShowConfirmKey(false)}>
                {t.settings.cancel}
              </Button>
              <Button className="flex-1" onClick={doActivate}>
                {t.settings.confirmChange}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── 切换模式确认弹窗 ── */}
      {switchTarget && connectionMode && (
        <SwitchModeDialog
          fromMode={connectionMode}
          toMode={switchTarget}
          onConfirm={() => handleSwitchConfirm(switchTarget)}
          onCancel={() => setSwitchTarget(null)}
        />
      )}

      {/* ── 模型 API 向导 ── */}
      {apiWizardOpen && licenseId && (
        <ApiWizard
          licenseId={licenseId}
          onSuccess={() => { setApiWizardOpen(false); verifyAndConnect() }}
          onClose={() => setApiWizardOpen(false)}
        />
      )}
    </>
  )
}

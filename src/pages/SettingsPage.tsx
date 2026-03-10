import { useState } from 'react'
import {
  KeyRound, AlertCircle, Loader2, X,
  Shield, MessageSquare, TriangleAlert, Palette, Languages,
  Sun, Moon, Monitor, Cpu, Cloud
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
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

/* THEMES & MODE_LABEL moved inside component to access `t` */

export function SettingsPage() {
  const {
    licenseKey, expiryDate, setLicenseKey,
    approvalRules, setApprovalRule,
    licenseId, connectionMode, setConnectionMode,
  } = useConfigStore()
  const { status, errorMessage } = useConnectionStore()
  const { verifyAndConnect } = useNodeConnection()
  const { openWizard } = useBootstrapStore()
  const t = useT()
  const { locale, theme, setLocale, setTheme } = useI18nStore()

  const [newKey, setNewKey] = useState('')
  const [showConfirmKey, setShowConfirmKey] = useState(false)
  const [licenseModalOpen, setLicenseModalOpen] = useState(false)
  const [localModalOpen, setLocalModalOpen] = useState(false)
  const [apiWizardOpen, setApiWizardOpen] = useState(false)
  const [switchTarget, setSwitchTarget] = useState<ConnectionMode | null>(null)

  const isLoading = status === 'auth_checking' || status === 'connecting'
  const isOnline = status === 'online'
  const hasKey = Boolean(licenseKey)

  const THEMES: { key: Theme; label: string; icon: React.ElementType }[] = [
    { key: 'light', label: t.settings.themeLight, icon: Sun },
    { key: 'dark', label: t.settings.themeDark, icon: Moon },
    { key: 'system', label: t.settings.themeSystem, icon: Monitor },
  ]

  const MODE_LABEL: Record<ConnectionMode, string> = {
    license: t.settings.modeCloud,
    local: t.settings.modeLocal,
  }

  const doActivate = async () => {
    setShowConfirmKey(false)
    setLicenseKey(newKey.trim())
    if (!connectionMode) {
      await invoke('save_app_config', { config: { connectionMode: 'license' } })
      setConnectionMode('license')
    }
    await verifyAndConnect()
  }

  const handleSwitchConfirm = (toMode: ConnectionMode) => {
    setConnectionMode(toMode)
    setSwitchTarget(null)
  }

  const handleLicenseCardClick = () => {
    if (connectionMode === 'local') {
      setSwitchTarget('license')
    } else {
      setLicenseModalOpen(true)
    }
  }

  const handleLocalCardClick = () => {
    if (connectionMode === 'license') {
      setSwitchTarget('local')
    } else {
      setLocalModalOpen(true)
    }
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
          <SectionHeader title={t.settings.sectionConnection} />

          {/* 两个连接卡片 */}
          <div className="grid grid-cols-2 gap-3">
            {/* License 卡片 */}
            <button
              type="button"
              onClick={handleLicenseCardClick}
              className="relative flex flex-col items-center justify-center text-left rounded-xl border border-card-border bg-card-bg p-3 hover:border-white/20 transition-all min-h-[80px]"
            >
              {connectionMode === 'license' && isOnline && (
                <span className="absolute top-2.5 left-2.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium leading-none">
                  {t.settings.current}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <Cloud size={15} className={connectionMode === 'license' && isOnline ? 'text-primary' : 'text-surface-on-variant'} />
                <span className="text-sm font-medium text-surface-on">{t.settings.cloud}</span>
              </div>
              {connectionMode === 'license' && isOnline && hasKey && (
                <div className="space-y-1 mt-1.5 w-full">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-surface-on-variant">{t.settings.keyLabel}</span>
                    <span className="font-mono text-surface-on">{maskLicenseKey(licenseKey)}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-surface-on-variant">{t.settings.expiryLabel}</span>
                    <span className="text-surface-on">
                      {expiryDate === 'Permanent' || !expiryDate ? t.settings.expiryPermanent : expiryDate}
                    </span>
                  </div>
                </div>
              )}
            </button>

            {/* 本地 卡片 */}
            <button
              type="button"
              onClick={handleLocalCardClick}
              className="relative flex flex-col items-center justify-center text-left rounded-xl border border-card-border bg-card-bg p-3 hover:border-white/20 transition-all min-h-[80px]"
            >
              {connectionMode === 'local' && isOnline && (
                <span className="absolute top-2.5 left-2.5 text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium leading-none">
                  {t.settings.current}
                </span>
              )}
              <div className="flex items-center gap-1.5">
                <Monitor size={15} className={connectionMode === 'local' && isOnline ? 'text-primary' : 'text-surface-on-variant'} />
                <span className="text-sm font-medium text-surface-on">{t.settings.local}</span>
              </div>
            </button>
          </div>
        </section>

        {/* ── 节点配置 ── */}
        <section>
          <SectionHeader title={t.settings.sectionNode} />

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
              <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <p className="text-sm text-surface-on-variant font-extrabold">{t.settings.activateFirst}</p>
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
          <SectionHeader title={t.settings.sectionPreferences} />
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
                    className={`px-4 py-1.5 text-sm rounded-lg border transition-all ${locale === loc
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
                    className={`flex items-center gap-2 px-4 py-1.5 text-sm rounded-lg border transition-all ${theme === key
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

      {/* ── License 操作弹窗 ── */}
      {licenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-80 bg-card-bg border border-card-border rounded-xl p-5 shadow-2xl ring-1 ring-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound size={15} className="text-primary" />
                <h3 className="text-sm font-semibold text-surface-on">{t.settings.licenseModalTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => { setLicenseModalOpen(false); setNewKey('') }}
                className="text-surface-on-variant hover:text-surface-on transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {hasKey && (
              <div className="rounded-lg border border-white/8 bg-surface px-3 py-2.5 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-surface-on-variant">{t.settings.currentKeyLabel}</span>
                  <span className="font-mono text-surface-on">{maskLicenseKey(licenseKey)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-surface-on-variant">{t.settings.expiryTimeLabel}</span>
                  <span className="text-surface-on">
                    {expiryDate === 'Permanent' || !expiryDate ? t.settings.expiryPermanent : expiryDate}
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-surface-on-variant mb-1.5 block">
                {hasKey ? t.settings.changeKey : t.settings.licenseKeyLabel}
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
              <div className="flex items-start gap-2 p-3 rounded-lg bg-error-container text-error-on-container text-xs">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <Button
              onClick={() => hasKey ? setShowConfirmKey(true) : doActivate()}
              disabled={isLoading || !newKey.trim()}
              className="w-full"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin" />
                  {status === 'auth_checking' ? t.settings.verifying : t.settings.connecting}
                </span>
              ) : hasKey ? t.settings.changeAndActivate : t.settings.verifyAndActivate}
            </Button>
          </div>
        </div>
      )}

      {/* ── 本地连接弹窗 ── */}
      {localModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-96 bg-card-bg border border-card-border rounded-xl p-5 shadow-2xl ring-1 ring-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Monitor size={15} className="text-primary" />
                <h3 className="text-sm font-semibold text-surface-on">{t.settings.localModalTitle}</h3>
              </div>
              <button
                type="button"
                onClick={() => setLocalModalOpen(false)}
                className="text-surface-on-variant hover:text-surface-on transition-colors"
              >
                <X size={15} />
              </button>
            </div>
            <LocalConnectPanel onConnected={async () => {
              if (!connectionMode) {
                await invoke('save_app_config', { config: { connectionMode: 'local' } })
                setConnectionMode('local')
              }
              setLocalModalOpen(false)
            }} />
          </div>
        </div>
      )}

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

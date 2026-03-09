import { useState } from 'react'
import { MessageSquare, Send } from 'lucide-react'
import { TopBar } from '../components/layout/TopBar'
import { Card, Button } from '../components/ui'
import { useBootstrapStore, useConfigStore } from '../store'
import { TelegramWizard } from '../components/features/wizard/TelegramWizard'
import { useT } from '../i18n'

export function ChannelPage() {
  const { openWizard } = useBootstrapStore()
  const { licenseId } = useConfigStore()
  const [telegramWizardOpen, setTelegramWizardOpen] = useState(false)
  const t = useT()

  return (
    <>
      <TopBar title={t.sidebar.channel} subtitle={t.topbar.channelSub} />
      <div className="flex-1 overflow-auto p-6 space-y-4 max-w-2xl">

        {/* 飞书配置卡片 */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-surface-on">{t.channel.feishu}</h2>
          </div>
          <p className="text-xs text-surface-on-variant mb-3">
            {t.channel.feishuDesc}
          </p>
          <Button variant="outlined" onClick={openWizard} disabled={!licenseId}>
            {t.channel.configureFeishu}
          </Button>
          {!licenseId && (
            <p className="text-xs text-surface-on-variant mt-2">
              {t.channel.activateFirst}
            </p>
          )}
        </Card>

        {/* Telegram 配置卡片 */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Send size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-surface-on">{t.channel.telegram}</h2>
          </div>
          <p className="text-xs text-surface-on-variant mb-3">
            {t.channel.telegramDesc}
          </p>
          <Button variant="outlined" onClick={() => setTelegramWizardOpen(true)} disabled={!licenseId}>
            {t.channel.configureTelegram}
          </Button>
          {!licenseId && (
            <p className="text-xs text-surface-on-variant mt-2">
              {t.channel.activateFirst}
            </p>
          )}
        </Card>

      </div>

      {telegramWizardOpen && licenseId && (
        <TelegramWizard
          licenseId={licenseId}
          onSuccess={() => setTelegramWizardOpen(false)}
          onClose={() => setTelegramWizardOpen(false)}
        />
      )}
    </>
  )
}

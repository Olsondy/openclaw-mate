import { useCallback, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ActivityPage } from './pages/ActivityPage'
import { CapabilitiesPage } from './pages/CapabilitiesPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'
import { useBootstrapStore, useConfigStore } from './store'
import { FeishuWizard } from './components/features/wizard/FeishuWizard'
import { ChannelAuthDialog } from './components/features/channel-auth/ChannelAuthDialog'
import { useNodeConnection } from './hooks/useNodeConnection'
import { useTauriEvent } from './hooks/useTauri'

type GatewayEventEnvelope = {
  event: string
  payload: unknown
}

function AppInner() {
  const { wizardOpen, needs, closeWizard } = useBootstrapStore()
  const { licenseId } = useConfigStore()
  const { verifyAndConnect } = useNodeConnection()
  const [showChannelAuthDialog, setShowChannelAuthDialog] = useState(false)

  useTauriEvent<GatewayEventEnvelope>(
    'ws:gateway_event',
    useCallback((envelope) => {
      if (envelope.event === 'channel.auth.required') {
        setShowChannelAuthDialog(true)
      } else if (envelope.event === 'channel.auth.resolved') {
        setShowChannelAuthDialog(false)
      }
    }, []),
  )

  return (
    <>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="capabilities" element={<CapabilitiesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      {wizardOpen && needs.feishu && licenseId && (
        <FeishuWizard
          licenseId={licenseId}
          onSuccess={() => { closeWizard(); verifyAndConnect() }}
          onClose={closeWizard}
        />
      )}
      {showChannelAuthDialog && (
        <ChannelAuthDialog
          onClose={() => setShowChannelAuthDialog(false)}
        />
      )}
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  )
}

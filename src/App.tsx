import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { ActivityPage } from './pages/ActivityPage'
import { CapabilitiesPage } from './pages/CapabilitiesPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'
import { useBootstrapStore, useConfigStore } from './store'
import { FeishuWizard } from './components/features/wizard/FeishuWizard'
import { useNodeConnection } from './hooks/useNodeConnection'

function AppInner() {
  const { wizardOpen, needs, closeWizard } = useBootstrapStore()
  const { licenseId, authToken } = useConfigStore()
  const { verifyAndConnect } = useNodeConnection()

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
      {wizardOpen && needs.feishu && licenseId && authToken && (
        <FeishuWizard
          licenseId={licenseId}
          authToken={authToken}
          onSuccess={() => { closeWizard(); verifyAndConnect() }}
          onClose={closeWizard}
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

import { TopBar } from '../components/layout/TopBar'

export function DashboardPage() {
  return (
    <>
      <TopBar title="Dashboard" subtitle="Node status and real-time tasks" />
      <div className="flex-1 overflow-auto p-6">
        <p className="text-surface-on-variant">Dashboard - coming soon</p>
      </div>
    </>
  )
}

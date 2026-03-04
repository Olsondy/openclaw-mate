import { TopBar } from '../components/layout/TopBar'

export function ActivityPage() {
  return (
    <>
      <TopBar title="Activity" subtitle="Real-time task execution logs" />
      <div className="flex-1 overflow-auto p-6">
        <p className="text-surface-on-variant">Activity - coming soon</p>
      </div>
    </>
  )
}

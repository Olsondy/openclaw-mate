import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useTaskHandler } from '../../hooks/useTaskHandler'

export function AppLayout() {
  useTaskHandler()

  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-surface-on">
      <Sidebar />
      <main className="flex-1 flex flex-col relative overflow-hidden bg-surface m-2 ml-0 rounded-lg shadow-sm">
        <Outlet />
      </main>
    </div>
  )
}

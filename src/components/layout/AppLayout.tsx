import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useTaskHandler } from '../../hooks/useTaskHandler'

export function AppLayout() {
  // 全局监听 Gateway 下发的任务事件，写入 TasksStore
  useTaskHandler()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col bg-surface m-4 ml-0 rounded-[28px] overflow-hidden relative shadow-sm border border-outline/20">
        <Outlet />
      </main>
    </div>
  )
}

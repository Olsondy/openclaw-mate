import { NavLink } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { useConnectionStore } from '../../store'
import { useConfigStore } from '../../store'

const navItems = [
  { to: '/', icon: '⊞', label: 'Dashboard' },
  { to: '/activity', icon: '⚡', label: 'Activity' },
  { to: '/capabilities', icon: '🔌', label: 'Capabilities' },
  { to: '/analytics', icon: '📈', label: 'Analytics' },
]

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  connecting: 'bg-yellow-500',
  auth_checking: 'bg-yellow-500',
  authorized: 'bg-yellow-500',
  error: 'bg-red-500',
  unauthorized: 'bg-red-500',
  idle: 'bg-gray-400',
  paused: 'bg-gray-400',
}

export function Sidebar() {
  const { status } = useConnectionStore()
  const { config } = useConfigStore()

  const openConsole = async () => {
    if (!config.cloud_console_url) return
    await invoke('open_cloud_console', { url: config.cloud_console_url })
  }

  return (
    <aside className="w-56 h-screen bg-surface border-r border-surface-variant flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-surface-variant">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white text-sm font-bold">OC</div>
          <div>
            <div className="text-sm font-semibold text-surface-on">OpenClaw Node</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${statusColors[status] ?? 'bg-gray-400'}`} />
              <span className="text-xs text-surface-on-variant capitalize">{status.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150 ${
                isActive
                  ? 'bg-secondary-container text-secondary-on-container font-medium'
                  : 'text-surface-on-variant hover:bg-surface-variant'
              }`
            }
          >
            <span className="text-base">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom items */}
      <div className="p-2 border-t border-surface-variant space-y-1">
        <button
          onClick={openConsole}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-surface-on-variant hover:bg-surface-variant transition-colors"
        >
          <span>🌐</span>
          云端控制台
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive
                ? 'bg-secondary-container text-secondary-on-container font-medium'
                : 'text-surface-on-variant hover:bg-surface-variant'
            }`
          }
        >
          <span>⚙️</span>
          Settings
        </NavLink>
      </div>
    </aside>
  )
}

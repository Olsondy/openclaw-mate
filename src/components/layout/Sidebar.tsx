import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Terminal,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Activity,
  Cpu,
  MessageSquare
} from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useConfigStore } from '../../store'
import { useT } from '../../i18n'

export function Sidebar() {
  const { runtimeConfig } = useConfigStore()
  const [collapsed, setCollapsed] = useState(false)
  const t = useT()

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: t.sidebar.dashboard },
    { to: '/activity', icon: Activity, label: t.sidebar.activity },
    { to: '/channel', icon: MessageSquare, label: t.sidebar.channel },
    { to: '/capabilities', icon: Cpu, label: t.sidebar.capabilities },
  ]

  const openConsole = async () => {
    if (!runtimeConfig?.gatewayWebUI) return
    await invoke('open_cloud_console', { url: runtimeConfig.gatewayWebUI })
  }

  const STROKE_WIDTH = 1.8

  return (
    <aside
      className={`h-screen flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${collapsed ? 'w-[68px]' : 'w-[240px]'
        }`}
    >
      {/* 1. TOP: Control Header */}
      <div className="h-14 flex items-center px-4 mb-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg text-surface-on-variant hover:bg-surface-variant/50 hover:text-surface-on transition-colors outline-none"
          title={collapsed ? t.sidebar.expand : t.sidebar.collapse}
        >
          {collapsed ? (
            <PanelLeftOpen size={20} strokeWidth={STROKE_WIDTH} />
          ) : (
            <PanelLeftClose size={20} strokeWidth={STROKE_WIDTH} />
          )}
        </button>
      </div>

      {/* 2. MIDDLE: Navigation Items */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto overflow-x-hidden pt-4 custom-scrollbar">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${isActive
                ? 'bg-nav-hover text-surface-on font-medium'
                : 'text-surface-on-variant hover:bg-nav-hover hover:text-surface-on'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <Icon
              size={18}
              strokeWidth={STROKE_WIDTH}
              className="shrink-0 transition-transform duration-200 group-hover:scale-110"
            />
            {!collapsed && (
              <span className="text-[13px] whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
                {label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* 3. BOTTOM: System Entries */}
      <div className="p-3 space-y-1">
        <button
          onClick={openConsole}
          title={collapsed ? t.sidebar.devConsole : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-surface-on-variant hover:bg-nav-hover hover:text-surface-on transition-all duration-200 group ${collapsed ? 'justify-center' : ''
            }`}
        >
          <Terminal
            size={18}
            strokeWidth={STROKE_WIDTH}
            className="shrink-0 group-hover:scale-110 transition-transform duration-200"
          />
          {!collapsed && (
            <span className="text-[13px] whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
              {t.sidebar.devConsole}
            </span>
          )}
        </button>

        <NavLink
          to="/settings"
          title={collapsed ? t.sidebar.settings : undefined}
          className={({ isActive }) =>
            `group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${isActive
              ? 'bg-nav-hover text-surface-on font-medium'
              : 'text-surface-on-variant hover:bg-nav-hover hover:text-surface-on'
            } ${collapsed ? 'justify-center' : ''}`
          }
        >
          <Settings
            size={18}
            strokeWidth={STROKE_WIDTH}
            className="shrink-0 group-hover:rotate-45 transition-transform duration-300"
          />
          {!collapsed && (
            <span className="text-[13px] whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
              {t.sidebar.settings}
            </span>
          )}
        </NavLink>
      </div>
    </aside >
  )
}

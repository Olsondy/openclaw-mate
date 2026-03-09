import { useMemo } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { Card } from '../components/ui'
import { useConnectionStore, useTasksStore } from '../store'
import { useNodeConnection } from '../hooks/useNodeConnection'
import { useUpdater } from '../hooks/useUpdater'
import { useT } from '../i18n'
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  HelpCircle,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Download,
  Timer,
  BarChart3,
  XCircle,
  Activity
} from 'lucide-react'
import type { ActivityLog } from '../types'

/** 颜色映射 */
const TYPE_COLORS: Record<string, string> = {
  browser: '#6366f1',
  system: '#10b981',
  vision: '#f59e0b',
  unknown: '#94a3b8'
}

export function DashboardPage() {
  const { status, onlineAt, errorMessage } = useConnectionStore()
  const { logs, pendingApprovals, getStats } = useTasksStore()
  const { verifyAndConnect } = useNodeConnection()
  const { newVersion, installing, installUpdate } = useUpdater()
  const t = useT()

  const statusLabelMap: Record<string, string> = {
    online: t.dashboard.statusOnline,
    connecting: t.dashboard.statusConnecting,
    auth_checking: t.dashboard.statusAuthChecking,
    authorized: t.dashboard.statusAuthorized,
    error: t.dashboard.statusError,
    unauthorized: t.dashboard.statusUnauthorized,
    idle: t.dashboard.statusIdle,
    paused: t.dashboard.statusPaused,
  }

  const stats = getStats()
  const isEmpty = logs.length === 0

  const typeBreakdown = useMemo(() => {
    const map: Record<string, { total: number; success: number; error: number }> = {}
    logs.forEach((log) => {
      const t = log.task_type ?? 'unknown'
      if (!map[t]) map[t] = { total: 0, success: 0, error: 0 }
      map[t].total++
      if (log.level === 'success') map[t].success++
      if (log.level === 'error') map[t].error++
    })
    return map
  }, [logs])

  const avgDuration = useMemo(() => {
    const withDuration = logs.filter((l) => l.duration_ms != null && l.duration_ms > 0)
    if (withDuration.length === 0) return 0
    const total = withDuration.reduce((sum, l) => sum + (l.duration_ms ?? 0), 0)
    return Math.round(total / withDuration.length)
  }, [logs])

  const avgDurationByType = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    logs.forEach((log) => {
      if (log.duration_ms == null || log.duration_ms <= 0) return
      const ty = log.task_type ?? 'unknown'
      if (!map[ty]) map[ty] = { total: 0, count: 0 }
      map[ty].total += log.duration_ms
      map[ty].count++
    })
    const result: Record<string, number> = {}
    for (const [k, v] of Object.entries(map)) {
      result[k] = Math.round(v.total / v.count)
    }
    return result
  }, [logs])

  const uptimeMinutes = onlineAt
    ? Math.floor((Date.now() - onlineAt.getTime()) / 60000)
    : 0

  return (
    <>
      <TopBar title={t.sidebar.dashboard} subtitle={t.topbar.dashboardSub} />
      <div className="flex-1 overflow-auto p-6 space-y-6">

        {newVersion && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 backdrop-blur-sm animate-in slide-in-from-top-2 duration-500">
            <div className="flex items-center gap-2">
              <Download size={16} className="text-primary" />
              <span className="text-sm text-surface-on">
                {t.dashboard.newVersion} <span className="font-semibold">{newVersion}</span> {t.dashboard.available}
              </span>
            </div>
            <button
              onClick={installUpdate}
              disabled={installing}
              className="px-4 py-1.5 text-xs font-medium rounded-full bg-primary text-white hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {installing ? t.dashboard.updating : t.dashboard.updateNow}
            </button>
          </div>
        )}

        {/* KPI 指标组 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<Activity size={16} />}
            label={t.dashboard.status}
            value={statusLabelMap[status] ?? status}
            subValue={`${t.dashboard.onlineDuration}: ${uptimeMinutes} Min`}
            color={status === 'online' ? 'text-green-500' : 'text-primary'}
          />
          <KpiCard
            icon={<ClipboardList size={16} />}
            label={t.dashboard.totalTasks}
            value={stats.total}
            subValue={`${t.dashboard.successRate}: ${stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}%`}
            color="text-indigo-500"
          />
          <KpiCard
            icon={<CheckCircle2 size={16} />}
            label={t.dashboard.successTasks}
            value={stats.success}
            subValue={`${t.dashboard.failed}: ${stats.error}`}
            color="text-emerald-500"
          />
          <KpiCard
            icon={<Timer size={16} />}
            label={t.dashboard.efficiency}
            value={avgDuration > 0 ? `${avgDuration}ms` : '--'}
            subValue={t.dashboard.avgDuration}
            color="text-amber-500"
          />
        </div>

        {/* 主内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* 左侧: 审批与活动日志 */}
          <div className="lg:col-span-2 space-y-6">

            {/* 待审批操作 */}
            {pendingApprovals.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/30 overflow-hidden">
                <div className="p-4 border-b border-amber-100 flex items-center justify-between">
                  <h2 className="text-[13px] font-semibold text-amber-900 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    {t.dashboard.pendingApprovals}
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                    {pendingApprovals.length}
                  </span>
                </div>
                <div className="p-2 space-y-2">
                  {pendingApprovals.map(({ task, resolve }) => (
                    <div key={task.task_id} className="flex items-center justify-between p-3 rounded-xl bg-surface border border-outline/10 shadow-sm transition-all hover:shadow-md">
                      <div>
                        <p className="text-sm font-medium text-surface-on capitalize">{task.type} {t.dashboard.instruction}</p>
                        <p className="text-[11px] text-surface-on-variant/70 font-mono">Task ID #{task.task_id}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => resolve(false)}
                          className="px-4 py-1.5 text-xs font-medium rounded-full border border-outline text-surface-on hover:bg-surface-variant transition-colors"
                        >
                          {t.dashboard.deny}
                        </button>
                        <button
                          onClick={() => resolve(true)}
                          className="px-4 py-1.5 text-xs font-medium rounded-full bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-all"
                        >
                          {t.dashboard.allow}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* 错误提示 */}
            {errorMessage && (
              <Card className="border-red-200 bg-red-50/30 p-4 flex items-center gap-3">
                <XCircle size={18} className="text-red-500 shrink-0" />
                <p className="text-[13px] text-red-700">{errorMessage}</p>
              </Card>
            )}

            {/* 最近活动记录 */}
            <Card className="flex flex-col h-[500px]">
              <div className="p-4 border-b border-outline/10 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-surface-on flex items-center gap-2">
                  <Activity size={16} className="text-primary" />
                  {t.dashboard.recentActivity}
                </h2>
                <span className="text-[11px] text-surface-on-variant lowercase">{t.dashboard.realtimeStream}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {isEmpty ? (
                  <div className="h-full flex flex-col items-center justify-center text-surface-on-variant/50 space-y-2 opacity-60">
                    <ClipboardList size={32} strokeWidth={1} />
                    <p className="text-xs">{t.dashboard.noActivity}</p>
                  </div>
                ) : (
                  logs.map((log) => <TaskLogRow key={log.id} log={log} />)
                )}
              </div>
            </Card>
          </div>

          {/* 右侧: 任务分布图与状态 */}
          <div className="space-y-6">

            <Card className="p-4">
              <h2 className="text-[13px] font-semibold text-surface-on mb-4 flex items-center gap-2">
                <BarChart3 size={16} className="text-primary" />
                {t.dashboard.taskDistribution}
              </h2>

              {isEmpty ? (
                <div className="py-12 flex flex-col items-center justify-center opacity-40">
                  <BarChart3 size={24} strokeWidth={1} />
                  <p className="text-[10px] mt-2">{t.dashboard.noStats}</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {Object.entries(typeBreakdown).map(([type, data]) => {
                    const pct = stats.total > 0 ? (data.total / stats.total) * 100 : 0
                    const color = TYPE_COLORS[type] ?? TYPE_COLORS.unknown
                    return (
                      <div key={type} className="group">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[12px] font-medium text-surface-on capitalize">{type}</span>
                          <span className="text-[10px] text-surface-on-variant font-mono">
                            {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-surface-variant overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000 ease-out group-hover:brightness-110"
                            style={{
                              width: `${Math.max(pct, 2)}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <div className="flex justify-between mt-1 text-[10px] text-surface-on-variant/60 font-mono">
                          <span>{data.total} {t.dashboard.tasks}</span>
                          {avgDurationByType[type] && <span>~{avgDurationByType[type]}ms</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* 节点连接简报 */}
            <Card className="p-4 bg-surface-variant/20 border-dashed">
              <h3 className="text-[11px] font-bold text-surface-on-variant/50 tracking-widest uppercase mb-4">
                {t.dashboard.nodeBriefing}
              </h3>
              <div className="space-y-3">
                <StatusItem label="Gateway" active={status === 'online'} />
                <StatusItem label="Socket Stream" active={status === 'online'} />
                <StatusItem label="Automation" active={true} />

                {status !== 'online' && (
                  <button
                    onClick={verifyAndConnect}
                    className="w-full mt-2 py-2 text-xs font-medium text-primary bg-primary/5 rounded-lg border border-primary/20 hover:bg-primary/10 transition-all flex items-center justify-center gap-2"
                  >
                    {t.dashboard.reconnect} <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </Card>

          </div>
        </div>
      </div>
    </>
  )
}

function KpiCard({ icon, label, value, subValue, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  subValue: string
  color: string
}) {
  return (
    <Card className="p-4 hover:border-primary/30 transition-all duration-300">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-surface-variant/50 ${color}`}>
        {icon}
      </div>
      <p className="text-[11px] font-medium text-surface-on-variant uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-surface-on mt-1 tabular-nums">{value}</p>
      <p className="text-[10px] text-surface-on-variant/60 mt-1 font-medium">{subValue}</p>
    </Card>
  )
}

function TaskLogRow({ log }: { log: ActivityLog }) {
  const levelIcon = {
    success: <CheckCircle2 size={14} className="text-emerald-500" />,
    error: <AlertCircle size={14} className="text-red-500" />,
    pending: <Clock size={14} className="text-amber-500 animate-pulse" />,
    warning: <AlertTriangle size={14} className="text-amber-500" />,
    info: <HelpCircle size={14} className="text-blue-400" />,
  }

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-variant/40 transition-all group border border-transparent hover:border-outline/5 shadow-none hover:shadow-sm">
      <div className="shrink-0">{levelIcon[log.level]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-surface-on truncate">{log.title}</span>
          {log.task_type && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider tabular-nums"
              style={{
                backgroundColor: `${TYPE_COLORS[log.task_type] ?? TYPE_COLORS.unknown}15`,
                color: TYPE_COLORS[log.task_type] ?? TYPE_COLORS.unknown,
              }}
            >
              {log.task_type}
            </span>
          )}
        </div>
        <p className="text-[11px] text-surface-on-variant/70 truncate">{log.description}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[10px] font-mono text-surface-on-variant/50 group-hover:text-surface-on-variant transition-colors">
          {(() => {
            try {
              const d = typeof log.timestamp === 'string' ? new Date(log.timestamp) : log.timestamp
              return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            } catch (e) {
              return '--:--:--'
            }
          })()}
        </p>
        {log.duration_ms != null && log.duration_ms > 0 && (
          <p className="text-[9px] font-semibold text-emerald-500/70">{log.duration_ms}ms</p>
        )}
      </div>
    </div>
  )
}

function StatusItem({ label, active }: { label: string; active: boolean }) {
  const t = useT()
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-surface-on-variant">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-surface-on-variant/20'}`} />
        <span className={`text-[10px] font-bold ${active ? 'text-emerald-600' : 'text-surface-on-variant/40'}`}>
          {active ? t.dashboard.nodeActive : t.dashboard.nodeIdle}
        </span>
      </div>
    </div>
  )
}

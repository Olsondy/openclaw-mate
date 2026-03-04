import { useMemo } from 'react'
import { TopBar } from '../components/layout/TopBar'
import { Card } from '../components/ui'
import { useTasksStore, useConnectionStore } from '../store'
import { BarChart3, CheckCircle2, XCircle, Clock, Timer, Wifi, WifiOff } from 'lucide-react'
import type { ActivityLog, TaskType } from '../types'

/** 颜色映射 */
const TYPE_COLORS: Record<string, string> = {
  browser: '#6366f1',
  system: '#10b981',
  vision: '#f59e0b',
}

export function AnalyticsPage() {
  const { logs } = useTasksStore()
  const { status, onlineAt } = useConnectionStore()
  const stats = useTasksStore().getStats()

  // 按 task_type 分组统计
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

  // 计算平均耗时
  const avgDuration = useMemo(() => {
    const withDuration = logs.filter((l) => l.duration_ms != null && l.duration_ms > 0)
    if (withDuration.length === 0) return 0
    const total = withDuration.reduce((sum, l) => sum + (l.duration_ms ?? 0), 0)
    return Math.round(total / withDuration.length)
  }, [logs])

  // 按类型的平均耗时
  const avgDurationByType = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {}
    logs.forEach((log) => {
      if (log.duration_ms == null || log.duration_ms <= 0) return
      const t = log.task_type ?? 'unknown'
      if (!map[t]) map[t] = { total: 0, count: 0 }
      map[t].total += log.duration_ms
      map[t].count++
    })
    const result: Record<string, number> = {}
    for (const [k, v] of Object.entries(map)) {
      result[k] = Math.round(v.total / v.count)
    }
    return result
  }, [logs])

  // 在线时长
  const uptime = onlineAt
    ? Math.floor((Date.now() - onlineAt.getTime()) / 60000)
    : 0

  const isEmpty = logs.length === 0

  return (
    <>
      <TopBar title="Analytics" subtitle="本节点运行分析" />
      <div className="flex-1 overflow-auto p-6 space-y-4 max-w-3xl">

        {/* KPI 卡片行 */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            icon={<BarChart3 size={16} />}
            label="本次任务"
            value={stats.total}
            color="text-primary"
          />
          <KpiCard
            icon={<CheckCircle2 size={16} />}
            label="成功"
            value={stats.success}
            color="text-green-500"
          />
          <KpiCard
            icon={<XCircle size={16} />}
            label="失败"
            value={stats.error}
            color="text-red-500"
          />
          <KpiCard
            icon={<Timer size={16} />}
            label="平均耗时"
            value={avgDuration > 0 ? `${avgDuration}ms` : '--'}
            color="text-yellow-500"
          />
        </div>

        {/* 连接状态卡片 */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            {status === 'online' ? (
              <Wifi size={16} className="text-green-500" />
            ) : (
              <WifiOff size={16} className="text-surface-on-variant" />
            )}
            <h2 className="text-sm font-semibold text-surface-on">连接状态</h2>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-surface-on-variant">当前状态</p>
              <p className={`font-medium ${status === 'online' ? 'text-green-500' : 'text-surface-on-variant'}`}>
                {status === 'online' ? '在线' : status === 'idle' ? '空闲' : status}
              </p>
            </div>
            <div>
              <p className="text-xs text-surface-on-variant">在线时长</p>
              <p className="font-medium text-surface-on">
                {uptime > 0 ? `${uptime} 分钟` : '--'}
              </p>
            </div>
            <div>
              <p className="text-xs text-surface-on-variant">成功率</p>
              <p className="font-medium text-surface-on">
                {stats.total > 0 ? `${Math.round((stats.success / stats.total) * 100)}%` : '--'}
              </p>
            </div>
          </div>
        </Card>

        {/* 任务类型分布 */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-surface-on">任务类型分布</h2>
          </div>

          {isEmpty ? (
            <p className="text-sm text-surface-on-variant text-center py-6">
              暂无任务数据，连接 Gateway 后将自动记录
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(typeBreakdown).map(([type, data]) => {
                const pct = stats.total > 0 ? (data.total / stats.total) * 100 : 0
                const color = TYPE_COLORS[type] ?? '#94a3b8'
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between items-center text-sm">
                      <span className="capitalize font-medium text-surface-on">{type}</span>
                      <span className="text-surface-on-variant text-xs">
                        {data.total} 条 ({Math.round(pct)}%)
                        {avgDurationByType[type] ? ` · 平均 ${avgDurationByType[type]}ms` : ''}
                      </span>
                    </div>
                    {/* SVG 条形图 */}
                    <div className="h-5 rounded-full bg-surface-variant overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${Math.max(pct, 2)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <div className="flex gap-3 text-xs text-surface-on-variant">
                      <span className="text-green-500">✓ {data.success}</span>
                      <span className="text-red-500">✗ {data.error}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* 最近任务列表 */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-surface-on">最近任务</h2>
          </div>

          {isEmpty ? (
            <p className="text-sm text-surface-on-variant text-center py-6">
              暂无任务记录
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {logs.slice(0, 20).map((log) => (
                <TaskLogRow key={log.id} log={log} />
              ))}
            </div>
          )}
        </Card>

      </div>
    </>
  )
}

/** KPI 数字卡片 */
function KpiCard({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
}) {
  return (
    <Card elevated>
      <div className={`flex items-center gap-1.5 mb-1 ${color}`}>
        {icon}
        <span className="text-xs text-surface-on-variant">{label}</span>
      </div>
      <p className="text-xl font-bold text-surface-on">{value}</p>
    </Card>
  )
}

/** 单条任务日志行 */
function TaskLogRow({ log }: { log: ActivityLog }) {
  const levelIcon = {
    success: <CheckCircle2 size={12} className="text-green-500" />,
    error: <XCircle size={12} className="text-red-500" />,
    pending: <Clock size={12} className="text-yellow-500 animate-pulse" />,
    warning: <Clock size={12} className="text-yellow-500" />,
    info: <Clock size={12} className="text-blue-400" />,
  }

  return (
    <div className="flex items-start gap-2 p-2 rounded-lg hover:bg-surface-variant/50 transition-colors">
      <div className="mt-0.5">{levelIcon[log.level]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-surface-on truncate">{log.title}</span>
          {log.task_type && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize"
              style={{
                backgroundColor: `${TYPE_COLORS[log.task_type] ?? '#94a3b8'}20`,
                color: TYPE_COLORS[log.task_type] ?? '#94a3b8',
              }}
            >
              {log.task_type}
            </span>
          )}
        </div>
        <p className="text-xs text-surface-on-variant truncate">{log.description}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[10px] text-surface-on-variant">
          {log.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
        {log.duration_ms != null && log.duration_ms > 0 && (
          <p className="text-[10px] text-surface-on-variant">{log.duration_ms}ms</p>
        )}
      </div>
    </div>
  )
}

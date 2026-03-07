import { TopBar } from '../components/layout/TopBar'
import { Card } from '../components/ui'
import { useConnectionStore, useTasksStore } from '../store'
import { useNodeConnection } from '../hooks/useNodeConnection'
import { useUpdater } from '../hooks/useUpdater'
import { CheckCircle2, AlertCircle, Clock, PauseCircle, HelpCircle, AlertTriangle, ArrowRight, ClipboardList, Percent, Download } from 'lucide-react'

const statusLabel: Record<string, string> = {
  online: '在线',
  connecting: '连接中',
  auth_checking: '验证中',
  authorized: '已授权',
  error: '错误',
  unauthorized: '未授权',
  idle: '空闲',
  paused: '已暂停',
}

const statusIcons: Record<string, any> = {
  online: CheckCircle2,
  connecting: Clock,
  auth_checking: Clock,
  authorized: Clock,
  error: AlertCircle,
  unauthorized: AlertCircle,
  idle: HelpCircle,
  paused: PauseCircle,
}

export function DashboardPage() {
  const { status, onlineAt, errorMessage } = useConnectionStore()
  const { pendingApprovals, getStats } = useTasksStore()
  const { verifyAndConnect } = useNodeConnection()
  const { newVersion, installing, installUpdate } = useUpdater()
  const stats = getStats()

  const uptime = onlineAt
    ? Math.floor((Date.now() - onlineAt.getTime()) / 60000) + ' 分钟'
    : '--'

  return (
    <>
      <TopBar title="Dashboard" subtitle="Node status and real-time activity" />
      <div className="flex-1 overflow-auto p-6 space-y-4">

        {newVersion && (
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-primary/10 border border-primary/30">
            <div className="flex items-center gap-2">
              <Download size={16} className="text-primary" />
              <span className="text-sm text-surface-on">
                发现新版本 <span className="font-semibold">{newVersion}</span> 可用
              </span>
            </div>
            <button
              onClick={installUpdate}
              disabled={installing}
              className="px-3 py-1 text-xs rounded-lg bg-primary text-white hover:opacity-90 disabled:opacity-50"
            >
              {installing ? '安装中...' : '立即更新'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Card elevated>
            <p className="text-xs text-surface-on-variant">节点状态</p>
            <div className="flex items-center gap-2 mt-1">
              {statusIcons[status] && (
                (() => {
                  const Icon = statusIcons[status];
                  return <Icon size={20} className={status === 'error' || status === 'unauthorized' ? 'text-error' : status === 'online' ? 'text-green-500' : 'text-yellow-500'} />;
                })()
              )}
              <p className="text-lg font-semibold text-surface-on">{statusLabel[status] ?? status}</p>
            </div>
            <p className="text-xs text-surface-on-variant mt-1">在线时长：{uptime}</p>
          </Card>
          <Card elevated>
            <p className="text-xs text-surface-on-variant">今日任务</p>
            <div className="flex items-center gap-2 mt-1">
              <ClipboardList size={20} className="text-primary" />
              <p className="text-lg font-semibold text-surface-on">{stats.total}</p>
            </div>
            <p className="text-xs text-surface-on-variant mt-1">成功 {stats.success} / 失败 {stats.error}</p>
          </Card>
          <Card elevated>
            <p className="text-xs text-surface-on-variant">成功率</p>
            <div className="flex items-center gap-2 mt-1">
              <Percent size={20} className="text-primary" />
              <p className="text-lg font-semibold text-surface-on">
                {stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : '--'}%
              </p>
            </div>
            <p className="text-xs text-surface-on-variant mt-1">共 {stats.total} 条任务</p>
          </Card>
        </div>

        {pendingApprovals.length > 0 && (
          <Card>
            <h2 className="text-sm font-semibold text-surface-on mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-yellow-500" />
              待审批操作 ({pendingApprovals.length})
            </h2>
            {pendingApprovals.map(({ task, resolve }) => (
              <div key={task.task_id} className="flex items-center justify-between p-3 rounded-lg bg-surface-variant mb-2">
                <div>
                  <p className="text-sm text-surface-on">{task.type} 操作</p>
                  <p className="text-xs text-surface-on-variant">Task #{task.task_id}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolve(false)}
                    className="px-3 py-1 text-xs rounded-lg border border-outline text-surface-on hover:bg-surface-variant"
                  >
                    拒绝
                  </button>
                  <button
                    onClick={() => resolve(true)}
                    className="px-3 py-1 text-xs rounded-lg bg-primary text-white hover:opacity-90"
                  >
                    允许执行
                  </button>
                </div>
              </div>
            ))}
          </Card>
        )}

        {errorMessage && (
          <Card>
            <p className="text-sm text-error">{errorMessage}</p>
          </Card>
        )}

        {(status === 'idle' || status === 'error') && (
          <Card>
            <p className="text-sm text-surface-on-variant mb-3">节点未连接，请前往 Settings 页面输入 License Key 激活。</p>
            <button
              onClick={verifyAndConnect}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              立即激活
              <ArrowRight size={14} />
            </button>
          </Card>
        )}
      </div>
    </>
  )
}

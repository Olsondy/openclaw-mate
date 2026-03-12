import {
	Activity,
	AlertCircle,
	AlertTriangle,
	BarChart3,
	CheckCircle2,
	ClipboardList,
	Clock,
	Cpu,
	Download,
	HelpCircle,
	Server,
	XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TopBar } from "../components/layout/TopBar";
import { Card } from "../components/ui";
import { useOperatorConnection } from "../hooks/useOperatorConnection";
import { useUpdater } from "../hooks/useUpdater";
import { useT } from "../i18n";
import { useConnectionStore, useTasksStore } from "../store";
import type { ActivityLog } from "../types";

const TYPE_COLORS: Record<string, string> = {
	browser: "#6366f1",
	system: "#10b981",
	vision: "#f59e0b",
	unknown: "#94a3b8",
};

export function DashboardPage() {
	const { errorMessage } = useConnectionStore();
	const { logs, pendingApprovals, getStats } = useTasksStore();
	const { newVersion, installing, installUpdate } = useUpdater();
	const { opCall, status: operatorStatus } = useOperatorConnection();
	const t = useT();
	const [gatewayVersion, setGatewayVersion] = useState("--");
	const [configuredModelsCount, setConfiguredModelsCount] = useState<
		number | null
	>(null);

	const stats = getStats();
	const taskLogs = useMemo(
		() => logs.filter((log) => log.source === "mate" && Boolean(log.task_id)),
		[logs],
	);
	const isEmpty = taskLogs.length === 0;
	const successRate =
		stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;

	useEffect(() => {
		let cancelled = false;

		if (operatorStatus !== "connected") {
			setGatewayVersion("--");
			setConfiguredModelsCount(null);
			return () => {
				cancelled = true;
			};
		}

		const loadDashboardMeta = async () => {
			const [presenceRes, modelsRes] = await Promise.all([
				opCall("system-presence", {}),
				opCall("models.list", {}),
			]);
			if (cancelled) {
				return;
			}

			const resolvedVersion = resolveGatewayVersion(presenceRes.payload);
			setGatewayVersion(resolvedVersion ?? "--");
			setConfiguredModelsCount(resolveConfiguredModelsCount(modelsRes.payload));
		};

		loadDashboardMeta().catch(() => {
			if (cancelled) {
				return;
			}
			setGatewayVersion("--");
			setConfiguredModelsCount(null);
		});

		return () => {
			cancelled = true;
		};
	}, [operatorStatus, opCall]);

	const typeBreakdown = useMemo(() => {
		const map: Record<
			string,
			{ total: number; success: number; error: number }
		> = {};
		for (const log of taskLogs) {
			const ty = log.task_type ?? "unknown";
			if (!map[ty]) map[ty] = { total: 0, success: 0, error: 0 };
			map[ty].total++;
			if (log.level === "success") map[ty].success++;
			if (log.level === "error") map[ty].error++;
		}
		return map;
	}, [taskLogs]);

	const avgDurationByType = useMemo(() => {
		const map: Record<string, { total: number; count: number }> = {};
		for (const log of taskLogs) {
			if (log.duration_ms == null || log.duration_ms <= 0) continue;
			const ty = log.task_type ?? "unknown";
			if (!map[ty]) map[ty] = { total: 0, count: 0 };
			map[ty].total += log.duration_ms;
			map[ty].count++;
		}
		const result: Record<string, number> = {};
		for (const [k, v] of Object.entries(map)) {
			result[k] = Math.round(v.total / v.count);
		}
		return result;
	}, [taskLogs]);

	return (
		<>
			<TopBar title={t.sidebar.dashboard} />
			<div className="flex-1 overflow-auto p-6 space-y-4">
				{/* 更新提示 */}
				{newVersion && (
					<div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/5 border border-primary/20">
						<div className="flex items-center gap-2">
							<Download size={15} className="text-primary" />
							<span className="text-sm text-surface-on">
								{t.dashboard.newVersion}{" "}
								<span className="font-semibold">{newVersion}</span>{" "}
								{t.dashboard.available}
							</span>
						</div>
						<button
							type="button"
							onClick={installUpdate}
							disabled={installing}
							className="px-3 py-1 text-xs font-medium rounded-full bg-primary text-primary-on hover:opacity-90 disabled:opacity-50 transition-all"
						>
							{installing ? t.dashboard.updating : t.dashboard.updateNow}
						</button>
					</div>
				)}

				{/* 4 个概要卡片 */}
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
					<Card className="flex items-center gap-4 py-3 px-4">
						<div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-500/10 text-indigo-500 shrink-0">
							<ClipboardList size={15} />
						</div>
						<div>
							<p className="text-[11px] text-surface-on-variant mb-0.5">
								{t.dashboard.totalTasks}
							</p>
							<p className="text-xl font-bold text-surface-on tabular-nums">
								{stats.total}
							</p>
						</div>
					</Card>

					<Card className="flex items-center gap-4 py-3 px-4">
						<div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-500 shrink-0">
							<CheckCircle2 size={15} />
						</div>
						<div>
							<p className="text-[11px] text-surface-on-variant mb-0.5">
								{t.dashboard.successTasks}
							</p>
							<div className="flex items-baseline gap-1.5">
								<p className="text-xl font-bold text-surface-on tabular-nums">
									{stats.success}
								</p>
								{stats.total > 0 && (
									<span className="text-xs text-emerald-500 font-medium">
										{successRate}%
									</span>
								)}
							</div>
						</div>
					</Card>

					<Card className="flex items-center gap-4 py-3 px-4">
						<div className="w-8 h-8 rounded-lg flex items-center justify-center bg-sky-500/10 text-sky-500 shrink-0">
							<Server size={15} />
						</div>
						<div>
							<p className="text-[11px] text-surface-on-variant mb-0.5">
								{t.dashboard.openclawVersion}
							</p>
							<p className="text-xl font-bold text-surface-on tabular-nums">
								{gatewayVersion}
							</p>
						</div>
					</Card>

					<Card className="flex items-center gap-4 py-3 px-4">
						<div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-500 shrink-0">
							<Cpu size={15} />
						</div>
						<div>
							<p className="text-[11px] text-surface-on-variant mb-0.5">
								{t.dashboard.configuredModels}
							</p>
							<p className="text-xl font-bold text-surface-on tabular-nums">
								{configuredModelsCount ?? "--"}
							</p>
						</div>
					</Card>
				</div>

				{/* 待审批 */}
				{pendingApprovals.length > 0 && (
					<Card className="border-amber-500/20 bg-amber-500/5 overflow-hidden">
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-xs font-semibold text-surface-on flex items-center gap-2">
								<AlertTriangle size={13} className="text-amber-500" />
								{t.dashboard.pendingApprovals}
							</h2>
							<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold">
								{pendingApprovals.length}
							</span>
						</div>
						<div className="space-y-2">
							{pendingApprovals.map(({ task, resolve }) => (
								<div
									key={task.task_id}
									className="flex items-center justify-between p-3 rounded-lg bg-surface border border-white/8"
								>
									<div>
										<p className="text-sm font-medium text-surface-on capitalize">
											{task.type} {t.dashboard.instruction}
										</p>
										<p className="text-[11px] text-surface-on-variant font-mono">
											#{task.task_id}
										</p>
									</div>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={() => resolve(false)}
											className="px-3 py-1 text-xs rounded-lg border border-white/15 text-surface-on hover:bg-surface-variant transition-colors"
										>
											{t.dashboard.deny}
										</button>
										<button
											type="button"
											onClick={() => resolve(true)}
											className="px-3 py-1 text-xs rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
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
					<Card className="border-red-500/20 bg-red-500/5 flex items-center gap-3 py-3 px-4">
						<XCircle size={15} className="text-red-500 shrink-0" />
						<p className="text-sm text-surface-on">{errorMessage}</p>
					</Card>
				)}

				{/* 主内容：活动日志 + 任务分布 */}
				<div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)] gap-4">
					{/* 活动日志 */}
					<Card className="flex flex-col" style={{ height: 420 }}>
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-xs font-semibold text-surface-on flex items-center gap-2">
								<Activity size={13} className="text-primary" />
								{t.dashboard.recentActivity}
							</h2>
							<span className="text-[11px] text-surface-on-variant">
								{t.dashboard.realtimeStream}
							</span>
						</div>
						<div className="flex-1 overflow-y-auto space-y-0.5">
							{isEmpty ? (
								<div className="h-full flex flex-col items-center justify-center text-surface-on-variant/40 space-y-2">
									<ClipboardList size={28} strokeWidth={1} />
									<p className="text-xs">{t.dashboard.noActivity}</p>
								</div>
							) : (
								taskLogs.map((log) => <TaskLogRow key={log.id} log={log} />)
							)}
						</div>
					</Card>

					{/* 任务分布 */}
					<Card className="flex flex-col" style={{ height: 420 }}>
						<h2 className="text-xs font-semibold text-surface-on flex items-center gap-2 mb-4">
							<BarChart3 size={13} className="text-primary" />
							{t.dashboard.taskDistribution}
						</h2>
						{isEmpty ? (
							<div className="flex-1 flex flex-col items-center justify-center opacity-40">
								<BarChart3 size={22} strokeWidth={1} />
								<p className="text-[11px] mt-2">{t.dashboard.noStats}</p>
							</div>
						) : (
							<div className="space-y-4">
								{Object.entries(typeBreakdown).map(([type, data]) => {
									const pct =
										stats.total > 0 ? (data.total / stats.total) * 100 : 0;
									const color = TYPE_COLORS[type] ?? TYPE_COLORS.unknown;
									return (
										<div key={type}>
											<div className="flex justify-between items-center mb-1">
												<span className="text-xs font-medium text-surface-on capitalize">
													{type}
												</span>
												<span className="text-[10px] text-surface-on-variant font-mono">
													{Math.round(pct)}%
												</span>
											</div>
											<div className="h-1.5 rounded-full bg-surface-variant overflow-hidden">
												<div
													className="h-full rounded-full transition-all duration-700"
													style={{
														width: `${Math.max(pct, 2)}%`,
														backgroundColor: color,
													}}
												/>
											</div>
											<div className="flex justify-between mt-0.5 text-[10px] text-surface-on-variant/50 font-mono">
												<span>
													{data.total} {t.dashboard.tasks}
												</span>
												{avgDurationByType[type] && (
													<span>~{avgDurationByType[type]}ms</span>
												)}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</Card>
				</div>
			</div>
		</>
	);
}

function resolveGatewayVersion(payload: unknown): string | null {
	if (!Array.isArray(payload)) {
		return null;
	}
	for (const item of payload) {
		if (!item || typeof item !== "object") {
			continue;
		}
		const entry = item as Record<string, unknown>;
		const mode = typeof entry.mode === "string" ? entry.mode.toLowerCase() : "";
		const reason =
			typeof entry.reason === "string" ? entry.reason.toLowerCase() : "";
		const version =
			typeof entry.version === "string" ? entry.version.trim() : "";
		if (!version) {
			continue;
		}
		if (mode === "gateway" || reason === "self") {
			return version;
		}
	}
	return null;
}

function resolveConfiguredModelsCount(payload: unknown): number | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const models = (payload as { models?: unknown }).models;
	if (!Array.isArray(models)) {
		return null;
	}
	return models.length;
}

function TaskLogRow({ log }: { log: ActivityLog }) {
	const levelIcon = {
		success: <CheckCircle2 size={13} className="text-emerald-500" />,
		error: <AlertCircle size={13} className="text-red-500" />,
		pending: <Clock size={13} className="text-amber-500 animate-pulse" />,
		warning: <AlertTriangle size={13} className="text-amber-500" />,
		info: <HelpCircle size={13} className="text-blue-400" />,
	};

	return (
		<div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-variant/40 transition-colors">
			<div className="shrink-0">{levelIcon[log.level]}</div>
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5">
					<span className="text-xs font-medium text-surface-on truncate">
						{log.title}
					</span>
					{log.task_type && (
						<span
							className="text-[9px] px-1 py-0.5 rounded font-bold uppercase tracking-wider shrink-0"
							style={{
								backgroundColor: `${TYPE_COLORS[log.task_type] ?? TYPE_COLORS.unknown}15`,
								color: TYPE_COLORS[log.task_type] ?? TYPE_COLORS.unknown,
							}}
						>
							{log.task_type}
						</span>
					)}
				</div>
				<p className="text-[11px] text-surface-on-variant truncate">
					{log.description}
				</p>
			</div>
			<div className="text-right shrink-0">
				<p className="text-[10px] font-mono text-surface-on-variant/50">
					{(() => {
						try {
							const d =
								typeof log.timestamp === "string"
									? new Date(log.timestamp)
									: log.timestamp;
							return d.toLocaleTimeString("zh-CN", {
								hour: "2-digit",
								minute: "2-digit",
								second: "2-digit",
							});
						} catch {
							return "--:--";
						}
					})()}
				</p>
				{log.duration_ms != null && log.duration_ms > 0 && (
					<p className="text-[9px] text-emerald-500/70 font-mono">
						{log.duration_ms}ms
					</p>
				)}
			</div>
		</div>
	);
}

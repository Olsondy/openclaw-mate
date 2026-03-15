import { useMemo, useState } from "react";
import { ActivityItem } from "../components/features/activity/ActivityItem";
import { TopBar } from "../components/layout/TopBar";
import { Select } from "../components/ui";
import { useT } from "../i18n";
import { useTasksStore } from "../store";
import type { ActivityLog, LogLevel } from "../types";

type LogSection = "client" | "audit" | "gateway";

export function ActivityPage() {
	const { logs, clientLogs, clearAllLogs } = useTasksStore();
	const [section, setSection] = useState<LogSection>("client");
	const [clientLevel, setClientLevel] = useState<LogLevel | "all">("all");
	const [auditLevel, setAuditLevel] = useState<LogLevel | "all">("all");
	const [gatewayLevel, setGatewayLevel] = useState<LogLevel | "all">("all");
	const [clientKeyword, setClientKeyword] = useState("");
	const [auditKeyword, setAuditKeyword] = useState("");
	const [gatewayKeyword, setGatewayKeyword] = useState("");
	const t = useT();

	const levelOptions: { value: LogLevel | "all"; label: string }[] = [
		{ value: "all", label: t.activity.all },
		{ value: "error", label: t.activity.errors },
		{ value: "success", label: t.activity.successes },
		{ value: "warning", label: t.activity.warnings },
		{ value: "info", label: "Info" },
		{ value: "pending", label: "Pending" },
	];

	const [auditLogs, gatewayLogs] = useMemo(() => {
		const gateway: ActivityLog[] = [];
		const audit: ActivityLog[] = [];
		for (const log of logs) {
			if (log.source === "gateway") {
				gateway.push(log);
				continue;
			}
			audit.push(log);
		}
		return [audit, gateway];
	}, [logs]);

	const filteredClientLogs = useMemo(
		() => filterLogs(clientLogs, clientLevel, clientKeyword),
		[clientLogs, clientKeyword, clientLevel],
	);
	const filteredAuditLogs = useMemo(
		() => filterLogs(auditLogs, auditLevel, auditKeyword),
		[auditLogs, auditKeyword, auditLevel],
	);
	const filteredGatewayLogs = useMemo(
		() => filterLogs(gatewayLogs, gatewayLevel, gatewayKeyword),
		[gatewayLogs, gatewayKeyword, gatewayLevel],
	);

	const currentLevel =
		section === "client"
			? clientLevel
			: section === "audit"
				? auditLevel
				: gatewayLevel;
	const currentKeyword =
		section === "client"
			? clientKeyword
			: section === "audit"
				? auditKeyword
				: gatewayKeyword;
	const currentLogs =
		section === "client"
			? filteredClientLogs
			: section === "audit"
				? filteredAuditLogs
				: filteredGatewayLogs;

	return (
		<>
			<TopBar title={t.sidebar.activity} />
			<div className="flex-1 overflow-auto">
				<div className="flex gap-0 px-6 border-b border-surface-variant">
					<button
						type="button"
						onClick={() => setSection("client")}
						className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
							section === "client"
								? "border-primary text-primary"
								: "border-transparent text-surface-on-variant hover:text-surface-on"
						}`}
					>
						{t.activityLog.clientTab}
					</button>
					<button
						type="button"
						onClick={() => setSection("audit")}
						className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
							section === "audit"
								? "border-primary text-primary"
								: "border-transparent text-surface-on-variant hover:text-surface-on"
						}`}
					>
						{t.activity.auditLogs}
					</button>
					<button
						type="button"
						onClick={() => setSection("gateway")}
						className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
							section === "gateway"
								? "border-primary text-primary"
								: "border-transparent text-surface-on-variant hover:text-surface-on"
						}`}
					>
						{t.activity.gatewayLogs}
					</button>
				</div>

				<div className="px-6 py-3 border-b border-surface-variant bg-surface/30">
					<div className="grid grid-cols-1 gap-3 md:grid-cols-[160px_1fr_auto] md:items-end">
						<div className="space-y-1">
							<label className="text-xs text-surface-on-variant">
								{t.activity.levelLabel}
							</label>
							<Select
								value={currentLevel}
								onChange={(v) => {
									const value = v as LogLevel | "all";
									if (section === "client") {
										setClientLevel(value);
										return;
									}
									if (section === "audit") {
										setAuditLevel(value);
										return;
									}
									setGatewayLevel(value);
								}}
								options={levelOptions}
								className="w-full"
							/>
						</div>
						<div className="space-y-1">
							<label className="text-xs text-surface-on-variant">
								{t.activity.keywordLabel}
							</label>
							<input
								value={currentKeyword}
								onChange={(e) => {
									if (section === "client") {
										setClientKeyword(e.target.value);
										return;
									}
									if (section === "audit") {
										setAuditKeyword(e.target.value);
										return;
									}
									setGatewayKeyword(e.target.value);
								}}
								placeholder={t.activity.keywordPlaceholder}
								className="w-full rounded-lg border border-white/15 bg-surface-variant px-3 py-2 text-xs text-surface-on placeholder:text-surface-on-variant/60 focus:outline-none"
							/>
						</div>
						<div className="flex items-end gap-2">
							<button
								type="button"
								onClick={() => {
									if (section === "client") {
										setClientLevel("all");
										setClientKeyword("");
										return;
									}
									if (section === "audit") {
										setAuditLevel("all");
										setAuditKeyword("");
										return;
									}
									setGatewayLevel("all");
									setGatewayKeyword("");
								}}
								className="h-9 rounded-lg border border-white/15 px-3 text-xs text-surface-on-variant hover:text-surface-on hover:bg-surface-variant/50 transition-colors"
							>
								{t.activity.clearFilters}
							</button>
							<button
								type="button"
								onClick={() => {
									void clearAllLogs();
								}}
								className="h-9 rounded-lg border border-red-500/40 px-3 text-xs text-red-200 hover:text-red-100 hover:bg-red-500/10 transition-colors"
							>
								{t.activity.clearLogsFile}
							</button>
						</div>
					</div>
				</div>

				<div className="px-6 pt-4">
					{currentLogs.length === 0 ? (
						<p className="text-sm text-surface-on-variant py-8 text-center">
							{t.activity.noLogs}
						</p>
					) : section === "client" ? (
						<div className="rounded-xl border border-surface-variant bg-surface p-3">
							<div className="max-h-[56vh] overflow-auto font-mono text-xs leading-6">
								{filteredClientLogs.map((log) => (
									<p
										key={log.id}
										className={`px-2 whitespace-pre-wrap break-all ${getClientLineColor(log.level)}`}
									>
										{formatClientLogLine(log)}
									</p>
								))}
							</div>
						</div>
					) : (
						currentLogs.map((log) => <ActivityItem key={log.id} log={log} />)
					)}
				</div>
			</div>
		</>
	);
}

function filterLogs(
	logs: ActivityLog[],
	level: LogLevel | "all",
	keyword: string,
): ActivityLog[] {
	const normalizedKeyword = keyword.trim().toLowerCase();
	return logs.filter((log) => {
		if (level !== "all" && log.level !== level) {
			return false;
		}
		if (!normalizedKeyword) {
			return true;
		}
		const searchText =
			`${log.title} ${log.description} ${log.tags.join(" ")}`.toLowerCase();
		return searchText.includes(normalizedKeyword);
	});
}

function formatClientLogLine(log: ActivityLog): string {
	const detail = [log.title.trim(), log.description.trim()]
		.filter(Boolean)
		.join(" | ");
	return `${formatLogTimestamp(log.timestamp)} [${log.level.toUpperCase()}] ${detail}`;
}

function formatLogTimestamp(value: Date): string {
	const date = value instanceof Date ? value : new Date(value);
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const hh = String(date.getHours()).padStart(2, "0");
	const min = String(date.getMinutes()).padStart(2, "0");
	const ss = String(date.getSeconds()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function getClientLineColor(level: LogLevel): string {
	switch (level) {
		case "error":
			return "text-red-300";
		case "warning":
			return "text-yellow-200";
		case "success":
			return "text-green-300";
		case "pending":
			return "text-orange-200";
		default:
			return "text-surface-on";
	}
}

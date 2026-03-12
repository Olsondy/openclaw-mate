import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { ActivityLog, PendingApproval, TaskStats } from "../types";

type LogBucket = "audit" | "client";

interface StoredActivityLogEntry {
	bucket: LogBucket;
	id: string;
	timestamp: string;
	task_id: string;
	source: string;
	level: string;
	title: string;
	description: string;
	tags: string[];
	task_type?: string;
	duration_ms?: number;
}

interface TasksState {
	logs: ActivityLog[];
	pendingApprovals: PendingApproval[];
	clientLogs: ActivityLog[];

	addLog: (log: ActivityLog) => void;
	updateLogStatus: (
		taskId: string,
		level: ActivityLog["level"],
		durationMs?: number,
	) => void;
	addPendingApproval: (approval: PendingApproval) => void;
	removePendingApproval: (task_id: string) => void;
	getStats: () => TaskStats;
	addClientLog: (log: ActivityLog) => void;
	clearClientLogs: () => void;
	hydrateLogsFromFile: () => Promise<void>;
	clearAllLogs: () => Promise<void>;
}

function getDayKey(date: Date = new Date()): string {
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

function toStoredEntry(
	log: ActivityLog,
	bucket: LogBucket,
): StoredActivityLogEntry {
	return {
		bucket,
		id: log.id,
		timestamp:
			log.timestamp instanceof Date
				? log.timestamp.toISOString()
				: new Date(log.timestamp).toISOString(),
		task_id: log.task_id,
		source: log.source,
		level: log.level,
		title: log.title,
		description: log.description,
		tags: Array.isArray(log.tags) ? log.tags : [],
		task_type: log.task_type,
		duration_ms: log.duration_ms,
	};
}

function toActivityLog(entry: StoredActivityLogEntry): ActivityLog {
	const normalizedLevel: ActivityLog["level"] =
		entry.level === "success" ||
		entry.level === "error" ||
		entry.level === "warning" ||
		entry.level === "pending"
			? entry.level
			: "info";
	return {
		id: entry.id,
		timestamp: new Date(entry.timestamp),
		task_id: entry.task_id ?? "",
		source: entry.source === "gateway" ? "gateway" : "mate",
		level: normalizedLevel,
		title: entry.title ?? "",
		description: entry.description ?? "",
		tags: Array.isArray(entry.tags) ? entry.tags : [],
		task_type: entry.task_type as ActivityLog["task_type"],
		duration_ms: entry.duration_ms,
	};
}

function isTauriRuntime(): boolean {
	return (
		typeof window !== "undefined" &&
		typeof (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !==
			"undefined"
	);
}

async function invokeLogCommand<T = void>(
	cmd: string,
	args?: Record<string, unknown>,
) {
	if (!isTauriRuntime()) return undefined as T | undefined;
	return invoke<T>(cmd, args);
}

async function persistLogToFile(
	log: ActivityLog,
	bucket: LogBucket,
): Promise<void> {
	try {
		await invokeLogCommand("append_activity_log", {
			dayKey: getDayKey(new Date()),
			entry: toStoredEntry(log, bucket),
		});
	} catch (error) {
		console.warn("[tasks.store] append_activity_log failed:", error);
	}
}

async function loadLogsFromFile(): Promise<StoredActivityLogEntry[]> {
	try {
		const result = await invokeLogCommand<StoredActivityLogEntry[]>(
			"load_activity_logs",
			{
				dayKey: getDayKey(new Date()),
			},
		);
		return Array.isArray(result) ? result : [];
	} catch (error) {
		console.warn("[tasks.store] load_activity_logs failed:", error);
		return [];
	}
}

async function clearLogsFile(): Promise<void> {
	try {
		await invokeLogCommand("clear_activity_logs");
	} catch (error) {
		console.warn("[tasks.store] clear_activity_logs failed:", error);
	}
}

export const useTasksStore = create<TasksState>((set, get) => ({
	logs: [],
	pendingApprovals: [],
	clientLogs: [],

	addLog: (log) => {
		set((state) => ({ logs: [log, ...state.logs].slice(0, 500) }));
		void persistLogToFile(log, "audit");
	},

	/** 更新任务日志状态（pending → success/error），并记录执行耗时 */
	updateLogStatus: (taskId, level, durationMs) => {
		set((state) => ({
			logs: state.logs.map((log) =>
				log.task_id === taskId
					? { ...log, level, duration_ms: durationMs ?? log.duration_ms }
					: log,
			),
		}));
		const updatedLog = get().logs.find((log) => log.task_id === taskId);
		if (updatedLog) {
			void persistLogToFile(updatedLog, "audit");
		}
	},

	addPendingApproval: (approval) =>
		set((state) => ({
			pendingApprovals: [...state.pendingApprovals, approval],
		})),

	removePendingApproval: (task_id) =>
		set((state) => ({
			pendingApprovals: state.pendingApprovals.filter(
				(a) => a.task.task_id !== task_id,
			),
		})),

	getStats: () => {
		const { logs } = get();
		const taskLogs = logs.filter(
			(log) => log.source === "mate" && Boolean(log.task_id),
		);
		return {
			total: taskLogs.length,
			success: taskLogs.filter((l) => l.level === "success").length,
			error: taskLogs.filter((l) => l.level === "error").length,
			pending: taskLogs.filter((l) => l.level === "pending").length,
		};
	},
	addClientLog: (log) => {
		set((s) => ({ clientLogs: [log, ...s.clientLogs].slice(0, 500) }));
		void persistLogToFile(log, "client");
	},
	clearClientLogs: () => set({ clientLogs: [] }),
	hydrateLogsFromFile: async () => {
		const entries = await loadLogsFromFile();
		if (!entries.length) {
			return;
		}

		// 同一 id 的多条记录按最后一条为准，避免 updateLogStatus 追加导致重复
		const dedupedByBucketAndId = new Map<string, StoredActivityLogEntry>();
		for (let i = entries.length - 1; i >= 0; i -= 1) {
			const item = entries[i];
			const bucket: LogBucket = item.bucket === "client" ? "client" : "audit";
			const key = `${bucket}:${item.id}`;
			if (!dedupedByBucketAndId.has(key)) {
				dedupedByBucketAndId.set(key, { ...item, bucket });
			}
		}

		const restored = Array.from(dedupedByBucketAndId.values());
		restored.sort((a, b) => {
			const ta = new Date(a.timestamp).getTime();
			const tb = new Date(b.timestamp).getTime();
			return tb - ta;
		});

		set({
			logs: restored
				.filter((entry) => entry.bucket === "audit")
				.map(toActivityLog)
				.slice(0, 500),
			clientLogs: restored
				.filter((entry) => entry.bucket === "client")
				.map(toActivityLog)
				.slice(0, 500),
		});
	},
	clearAllLogs: async () => {
		await clearLogsFile();
		set({ logs: [], clientLogs: [] });
	},
}));

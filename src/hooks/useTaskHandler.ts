import { useCallback } from "react";
import { useConfigStore, useTasksStore } from "../store";
import type { ActivityLog, TaskType } from "../types";
import { useTauriEvent } from "./useTauri";

/**
 * ws:task 事件携带的数据结构（与 Rust WsTask 对应）
 */
interface WsTaskPayload {
	task_id: string;
	type: string;
	payload: Record<string, unknown>;
	require_approval: boolean;
	timeout_ms: number;
}

/**
 * ws:task_result 事件携带的数据结构（与 Rust TaskResult 对应）
 */
interface WsTaskResult {
	task_id: string;
	success: boolean;
	stdout: string;
	stderr: string;
	exit_code: number | null;
	duration_ms: number;
}

/**
 * 监听 Rust 后端 emit 的任务事件，将任务日志写入 Store。
 * 应在 App 全局挂载一次（如 AppLayout 中）。
 */
export function useTaskHandler() {
	const { addLog, updateLogStatus } = useTasksStore();
	const { approvalRules } = useConfigStore();

	// 收到新任务
	useTauriEvent<WsTaskPayload>(
		"ws:task",
		useCallback(
			(task) => {
				const taskType = task.type as TaskType;
				const needsApproval =
					approvalRules[taskType] === "always" ||
					(approvalRules[taskType] === "sensitive_only" &&
						task.require_approval);

				const log: ActivityLog = {
					id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
					timestamp: new Date(),
					task_id: task.task_id,
					level: needsApproval ? "pending" : "info",
					title: `${task.type} 任务`,
					description: formatDescription(task),
					tags: [task.type],
					task_type: taskType,
				};

				addLog(log);
			},
			[addLog, approvalRules],
		),
	);

	// 任务执行完成
	useTauriEvent<WsTaskResult>(
		"ws:task_result",
		useCallback(
			(result) => {
				updateLogStatus(
					result.task_id,
					result.success ? "success" : "error",
					result.duration_ms,
				);
			},
			[updateLogStatus],
		),
	);

	// Gateway 推送事件
	useTauriEvent<{ event: string; payload: unknown }>(
		"ws:gateway_event",
		useCallback(
			(data) => {
				const log: ActivityLog = {
					id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
					timestamp: new Date(),
					task_id: "",
					level: "info",
					title: `事件: ${data.event}`,
					description: JSON.stringify(data.payload ?? {}).slice(0, 200),
					tags: ["event"],
				};
				addLog(log);
			},
			[addLog],
		),
	);
}

/** 将任务 payload 格式化为可读描述 */
function formatDescription(task: WsTaskPayload): string {
	const payload = task.payload ?? {};
	if (task.type === "system" && payload.command) {
		return `$ ${String(payload.command)}`;
	}
	return JSON.stringify(payload).slice(0, 200);
}

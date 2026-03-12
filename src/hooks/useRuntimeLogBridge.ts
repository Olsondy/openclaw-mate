import { useCallback } from "react";
import {
	inferGatewayEventLevel,
	makeLogId,
	parseGatewayEventFromRaw,
	summarizeLogPayload,
} from "../lib/activity-log";
import { useTasksStore } from "../store";
import type { ActivityLog } from "../types";
import { useTauriEvent } from "./useTauri";

interface OperatorEventPayload {
	raw: string;
}

export function useRuntimeLogBridge() {
	const addLog = useTasksStore((s) => s.addLog);

	const addMateLog = useCallback(
		(
			level: ActivityLog["level"],
			title: string,
			description: string,
			tags: string[],
		) => {
			addLog({
				id: makeLogId("mate"),
				timestamp: new Date(),
				task_id: "",
				source: "mate",
				level,
				title,
				description,
				tags,
			});
		},
		[addLog],
	);

	useTauriEvent(
		"ws:connected",
		useCallback(() => {
			addMateLog(
				"success",
				"Mate: Node connected",
				"Gateway websocket connected.",
				["mate", "ws", "connected"],
			);
		}, [addMateLog]),
	);

	useTauriEvent(
		"ws:disconnected",
		useCallback(() => {
			addMateLog(
				"warning",
				"Mate: Node disconnected",
				"Gateway websocket disconnected.",
				["mate", "ws", "disconnected"],
			);
		}, [addMateLog]),
	);

	useTauriEvent<string>(
		"ws:error",
		useCallback(
			(msg) => {
				addMateLog("error", "Mate: Node error", msg || "Unknown node error.", [
					"mate",
					"ws",
					"error",
				]);
			},
			[addMateLog],
		),
	);

	useTauriEvent(
		"op:connected",
		useCallback(() => {
			addMateLog(
				"success",
				"Mate: Operator connected",
				"Operator channel connected.",
				["mate", "operator", "connected"],
			);
		}, [addMateLog]),
	);

	useTauriEvent(
		"op:disconnected",
		useCallback(() => {
			addMateLog(
				"warning",
				"Mate: Operator disconnected",
				"Operator channel disconnected.",
				["mate", "operator", "disconnected"],
			);
		}, [addMateLog]),
	);

	useTauriEvent<string>(
		"op:error",
		useCallback(
			(msg) => {
				addMateLog(
					"error",
					"Mate: Operator error",
					msg || "Unknown operator error.",
					["mate", "operator", "error"],
				);
			},
			[addMateLog],
		),
	);

	useTauriEvent<OperatorEventPayload>(
		"op:event",
		useCallback(
			(payload) => {
				const parsed = parseGatewayEventFromRaw(payload.raw);
				if (!parsed) {
					addLog({
						id: makeLogId("gw"),
						timestamp: new Date(),
						task_id: "",
						source: "gateway",
						level: "info",
						title: "Gateway: operator event",
						description: summarizeLogPayload(payload.raw),
						tags: ["gateway", "event", "operator"],
					});
					return;
				}

				addLog({
					id: makeLogId("gw"),
					timestamp: new Date(),
					task_id: "",
					source: "gateway",
					level: inferGatewayEventLevel(parsed.event),
					title: `Gateway: ${parsed.event}`,
					description: summarizeLogPayload(parsed.payload),
					tags: ["gateway", "event", "operator", parsed.event],
				});
			},
			[addLog],
		),
	);
}

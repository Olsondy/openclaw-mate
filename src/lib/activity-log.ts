import type { ActivityLog } from "../types";

interface ParsedGatewayEvent {
	event: string;
	payload: unknown;
}

export function makeLogId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function inferGatewayEventLevel(
	eventName: string,
): ActivityLog["level"] {
	const normalized = eventName.toLowerCase();
	if (
		normalized.includes("error") ||
		normalized.includes("fail") ||
		normalized.includes("reject")
	) {
		return "error";
	}
	if (
		normalized.includes("warn") ||
		normalized.includes("required") ||
		normalized.includes("timeout")
	) {
		return "warning";
	}
	if (
		normalized.includes("resolved") ||
		normalized.includes("success") ||
		normalized.includes("connected")
	) {
		return "success";
	}
	return "info";
}

export function summarizeLogPayload(payload: unknown, maxLen = 200): string {
	try {
		return JSON.stringify(payload ?? {}).slice(0, maxLen);
	} catch {
		return String(payload ?? "").slice(0, maxLen);
	}
}

export function parseGatewayEventFromRaw(
	raw: string,
): ParsedGatewayEvent | null {
	try {
		const parsed = JSON.parse(raw) as {
			type?: string;
			event?: string;
			payload?: unknown;
		};
		if (parsed.type !== "event") {
			return null;
		}
		return {
			event: parsed.event || "unknown",
			payload: parsed.payload ?? null,
		};
	} catch {
		return null;
	}
}

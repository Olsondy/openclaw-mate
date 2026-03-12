import { waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActivityLog } from "../types";
import { useTasksStore } from "./tasks.store";

const invokeMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));

describe("tasks store log persistence", () => {
	beforeEach(() => {
		invokeMock.mockReset();
		invokeMock.mockResolvedValue(undefined);
		useTasksStore.setState({ logs: [], clientLogs: [], pendingApprovals: [] });
	});

	it("persists client logs even when tauri internals flag is absent", async () => {
		const log: ActivityLog = {
			id: "test-1",
			timestamp: new Date("2026-03-12T10:00:00.000Z"),
			task_id: "",
			source: "mate",
			level: "info",
			title: "Mate: test log",
			description: "persist to file",
			tags: ["mate", "test"],
		};

		useTasksStore.getState().addClientLog(log);

		await waitFor(() => {
			expect(invokeMock).toHaveBeenCalledWith(
				"append_activity_log",
				expect.objectContaining({
					entry: expect.objectContaining({
						id: "test-1",
						bucket: "client",
					}),
				}),
			);
		});
	});
});

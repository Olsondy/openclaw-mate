import type { ActivityLog, Task } from "./index";

describe("Types", () => {
	it("Task type has required fields", () => {
		const task: Task = {
			task_id: "test-1",
			type: "browser",
			payload: {},
			require_approval: false,
			timeout_ms: 5000,
		};
		expect(task.task_id).toBe("test-1");
		expect(task.type).toBe("browser");
	});

	it("ActivityLog level accepts valid values", () => {
		const log: ActivityLog = {
			id: "1",
			timestamp: new Date(),
			task_id: "task-1",
			source: "mate",
			level: "success",
			title: "Test",
			description: "Test log",
			tags: ["BROWSER"],
		};
		expect(log.level).toBe("success");
	});
});

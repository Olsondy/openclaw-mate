import { render, screen } from "@testing-library/react";
import type { ActivityLog } from "../../../types";
import { ActivityItem } from "./ActivityItem";

const mockLog: ActivityLog = {
	id: "1",
	timestamp: new Date("2026-03-04T14:30:00"),
	task_id: "task-1",
	level: "success",
	title: "Browser task completed",
	description: "Searched for weather info",
	tags: ["SUCCESS", "BROWSER"],
};

describe("ActivityItem", () => {
	it("renders title and description", () => {
		render(<ActivityItem log={mockLog} />);
		expect(screen.getByText("Browser task completed")).toBeInTheDocument();
		expect(screen.getByText("Searched for weather info")).toBeInTheDocument();
	});

	it("renders tags", () => {
		render(<ActivityItem log={mockLog} />);
		expect(screen.getByText("SUCCESS")).toBeInTheDocument();
		expect(screen.getByText("BROWSER")).toBeInTheDocument();
	});
});

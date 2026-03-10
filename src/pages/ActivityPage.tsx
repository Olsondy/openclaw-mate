import { useState } from "react";
import { ActivityItem } from "../components/features/activity/ActivityItem";
import { TopBar } from "../components/layout/TopBar";
import { useT } from "../i18n";
import { useTasksStore } from "../store";
import type { LogLevel } from "../types";

export function ActivityPage() {
	const { logs } = useTasksStore();
	const [activeTab, setActiveTab] = useState<LogLevel | "all">("all");
	const t = useT();

	const tabs: { label: string; filter: LogLevel | "all" }[] = [
		{ label: t.activity.all, filter: "all" },
		{ label: t.activity.errors, filter: "error" },
		{ label: t.activity.successes, filter: "success" },
		{ label: t.activity.warnings, filter: "warning" },
	];

	const filtered =
		activeTab === "all" ? logs : logs.filter((l) => l.level === activeTab);

	return (
		<>
			<TopBar title={t.sidebar.activity} subtitle={t.topbar.activitySub} />
			<div className="flex-1 overflow-auto">
				<div className="flex gap-0 px-6 border-b border-surface-variant">
					{tabs.map(({ label, filter }) => (
						<button
							key={filter}
							onClick={() => setActiveTab(filter)}
							className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
								activeTab === filter
									? "border-primary text-primary"
									: "border-transparent text-surface-on-variant hover:text-surface-on"
							}`}
						>
							{label}
						</button>
					))}
				</div>

				<div className="px-6 pt-4">
					{filtered.length === 0 ? (
						<p className="text-sm text-surface-on-variant py-8 text-center">
							{t.activity.noLogs}
						</p>
					) : (
						filtered.map((log) => <ActivityItem key={log.id} log={log} />)
					)}
				</div>
			</div>
		</>
	);
}

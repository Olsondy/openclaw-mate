import { Zap } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { useT } from "../i18n";
import { useOperatorStore } from "../store";

export function SkillsPage() {
	const t = useT();
	const operatorStatus = useOperatorStore((s) => s.status);
	const isConnected = operatorStatus === "connected";

	return (
		<>
			<TopBar title={t.skills.title} subtitle={t.topbar.skillsSub} />
			<div className="flex-1 overflow-auto p-6">
				{!isConnected ? (
					<div className="flex flex-col items-center justify-center h-full gap-3 text-surface-on-variant/50">
						<Zap
							size={32}
							strokeWidth={1.5}
							className="text-surface-on-variant/30"
						/>
						<p className="text-sm font-medium text-surface-on-variant">
							{t.skills.notConnected}
						</p>
						<p className="text-xs text-center max-w-xs">
							{t.skills.notConnectedHint}
						</p>
					</div>
				) : (
					<SkillsContent />
				)}
			</div>
		</>
	);
}

function SkillsContent() {
	const t = useT();
	return (
		<div className="flex flex-col items-center justify-center h-full gap-3 text-surface-on-variant/50">
			<Zap size={32} strokeWidth={1.5} className="text-surface-on-variant/30" />
			<p className="text-xs">{t.skills.noSkills}</p>
		</div>
	);
}

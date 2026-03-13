import { Layers } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { useT } from "../i18n";
import { useOperatorStore } from "../store";

export function ModelsPage() {
	const t = useT();
	const operatorStatus = useOperatorStore((s) => s.status);
	const isConnected = operatorStatus === "connected";

	return (
		<>
			<TopBar title={t.models.title} subtitle={t.topbar.modelsSub} />
			<div className="flex-1 overflow-auto p-6">
				{!isConnected ? (
					<div className="flex flex-col items-center justify-center h-full gap-3 text-surface-on-variant/50">
						<Layers
							size={32}
							strokeWidth={1.5}
							className="text-surface-on-variant/30"
						/>
						<p className="text-sm font-medium text-surface-on-variant">
							{t.models.notConnected}
						</p>
						<p className="text-xs text-center max-w-xs">
							{t.models.notConnectedHint}
						</p>
					</div>
				) : (
					<ModelsContent />
				)}
			</div>
		</>
	);
}

function ModelsContent() {
	const t = useT();
	return (
		<div className="flex flex-col items-center justify-center h-full gap-3 text-surface-on-variant/50">
			<Layers
				size={32}
				strokeWidth={1.5}
				className="text-surface-on-variant/30"
			/>
			<p className="text-xs">{t.models.noModels}</p>
		</div>
	);
}

import { Eye, Globe, Monitor } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { Card, Switch } from "../components/ui";
import { useT } from "../i18n";
import { useConfigStore } from "../store";

export function CapabilitiesPage() {
	const { capabilities, toggleCapability } = useConfigStore();
	const t = useT();

	const modules = [
		{
			key: "browser" as const,
			icon: Globe,
			title: t.capabilities.browser,
			description: t.capabilities.browserDesc,
		},
		{
			key: "system" as const,
			icon: Monitor,
			title: t.capabilities.system,
			description: t.capabilities.systemDesc,
		},
		{
			key: "vision" as const,
			icon: Eye,
			title: t.capabilities.vision,
			description: t.capabilities.visionDesc,
		},
	];

	return (
		<>
			<TopBar
				title={t.sidebar.capabilities}
				subtitle={t.topbar.capabilitiesSub}
			/>
			<div className="flex-1 overflow-auto p-6 space-y-3 max-w-2xl">
				{modules.map(({ key, icon: Icon, title, description }) => (
					<Card key={key}>
						<div className="flex items-start justify-between gap-4">
							<div className="flex items-start gap-3">
								<Icon className="w-6 h-6 text-primary mt-0.5" strokeWidth={2} />
								<div>
									<p className="text-sm font-medium text-surface-on">{title}</p>
									<p className="text-xs text-surface-on-variant mt-1 leading-relaxed">
										{description}
									</p>
								</div>
							</div>
							<Switch
								checked={capabilities[key]}
								onChange={() => toggleCapability(key)}
							/>
						</div>
					</Card>
				))}
			</div>
		</>
	);
}

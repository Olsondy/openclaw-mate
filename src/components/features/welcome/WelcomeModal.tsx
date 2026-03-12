import { invoke } from "@tauri-apps/api/core";
import { ArrowRight, KeyRound, Monitor } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "../../../i18n";
import { useConfigStore } from "../../../store";
import type { ConnectionMode } from "../../../store/config.store";
import { Card } from "../../ui";

interface Props {
	onDone: () => void;
}

export function WelcomeModal({ onDone }: Props) {
	const { setConnectionMode } = useConfigStore();
	const navigate = useNavigate();
	const t = useT();
	const [selected, setSelected] = useState<ConnectionMode | null>(null);
	const [loading, setLoading] = useState(false);

	const OPTIONS: {
		mode: ConnectionMode;
		icon: React.ElementType;
		title: string;
		desc: string;
		hint: string;
	}[] = [
		{
			mode: "local",
			icon: Monitor,
			title: t.welcome.localTitle,
			desc: t.welcome.localDesc,
			hint: t.welcome.localHint,
		},
		{
			mode: "license",
			icon: KeyRound,
			title: t.welcome.licenseTitle,
			desc: t.welcome.licenseDesc,
			hint: t.welcome.licenseHint,
		},
	];

	const handleConfirm = async () => {
		if (!selected) return;
		setLoading(true);
		try {
			await invoke("save_app_config", { config: { connectionMode: selected } });
			setConnectionMode(selected);
			onDone();
			navigate("/settings");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
			<Card className="w-full max-w-lg p-8">
				{/* 标题 */}
				<div className="text-center mb-8">
					<h1 className="text-2xl font-semibold text-surface-on mb-2">
						{t.welcome.title}
					</h1>
					<p className="text-sm text-surface-on-variant">
						{t.welcome.subtitle}
					</p>
				</div>

				{/* 选项卡片 */}
				<div className="grid grid-cols-2 gap-4 mb-8">
					{OPTIONS.map(({ mode, icon: Icon, title, desc, hint }) => {
						const isActive = selected === mode;
						return (
							<button
								key={mode}
								type="button"
								onClick={() => setSelected(mode)}
								className={`
                  text-left p-5 rounded-xl border transition-all duration-300
                  ${
										isActive
											? "border-primary/60 bg-primary/5 ring-1 ring-primary/30 shadow-sm"
											: "border-card-border bg-card-bg hover:border-primary/30 hover:-translate-y-1 hover:shadow-md"
									}
                `}
							>
								<div
									className={`mb-3 w-9 h-9 rounded-lg flex items-center justify-center
                  ${isActive ? "bg-primary/15" : "bg-surface-variant"}`}
								>
									<Icon
										size={18}
										className={
											isActive ? "text-primary" : "text-surface-on-variant"
										}
									/>
								</div>
								<div className="text-sm font-medium text-surface-on mb-1.5">
									{title}
								</div>
								<div className="text-xs text-surface-on-variant leading-relaxed mb-3">
									{desc}
								</div>
								<div
									className={`text-[11px] ${isActive ? "text-primary" : "text-surface-on-variant/60"}`}
								>
									{hint}
								</div>
							</button>
						);
					})}
				</div>

				{/* 操作按钮 */}
				<div className="flex flex-col gap-3">
					<button
						type="button"
						disabled={!selected || loading}
						onClick={handleConfirm}
						className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
              bg-primary text-primary-on text-sm font-semibold
              disabled:opacity-40 disabled:cursor-not-allowed
              hover:opacity-90 transition-opacity"
					>
						{loading ? t.welcome.initializing : t.welcome.continue}
						{!loading && <ArrowRight size={15} />}
					</button>
					<button
						type="button"
						disabled={loading}
						onClick={onDone}
						className="w-full py-2 text-xs text-surface-on-variant hover:text-surface-on transition-colors disabled:opacity-40"
					>
						{t.welcome.skip}
					</button>
				</div>
			</Card>
		</div>
	);
}

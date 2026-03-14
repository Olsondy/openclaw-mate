import { invoke } from "@tauri-apps/api/core";
import {
	ArrowRight,
	Cable,
	HardDrive,
	KeyRound,
	Server,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "../../../i18n";
import { useConfigStore } from "../../../store";
import type { ConnectionMode, DirectMode } from "../../../store/config.store";
import { Button, Card } from "../../ui";
import { ConnectionModeCard } from "../connection/ConnectionModeCard";

interface Props {
	onDone: () => void;
}

export function WelcomeModal({ onDone }: Props) {
	const {
		setConnectionMode,
		setDirectMode,
		setDirectCloudAddress,
		setGuideEligible,
	} = useConfigStore();
	const navigate = useNavigate();
	const t = useT();
	const [selected, setSelected] = useState<ConnectionMode | null>(null);
	const [loading, setLoading] = useState(false);
	const [directPickerOpen, setDirectPickerOpen] = useState(false);
	const [directTarget, setDirectTarget] = useState<DirectMode | null>(null);
	const [directAddress, setDirectAddress] = useState("");

	const canContinue = useMemo(() => {
		if (selected === "tenant") return true;
		if (selected !== "direct") return false;
		if (!directTarget) return false;
		if (directTarget === "local") return true;
		return Boolean(directAddress.trim());
	}, [directAddress, directTarget, selected]);

	const handleConfirm = async () => {
		if (!selected || !canContinue) return;
		setLoading(true);
		try {
			await invoke("save_app_config", { config: { connectionMode: selected } });
			setConnectionMode(selected);
			if (selected === "direct") {
				setDirectMode(directTarget);
				if (directTarget === "cloud") {
					setDirectCloudAddress(directAddress.trim());
				} else {
					setDirectCloudAddress("");
				}
			}
			// 用户通过引导流程选择连接方式，标记为引导资格，以便连接成功后弹出配置引导
			setGuideEligible(true);
			onDone();
			navigate("/settings");
		} finally {
			setLoading(false);
		}
	};

	const openDirectPicker = () => {
		setSelected("direct");
		setDirectPickerOpen(true);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
			<Card className="w-full max-w-lg p-8">
				<div className="text-center mb-8">
					<h1 className="text-2xl font-semibold text-surface-on mb-2">
						{t.welcome.title}
					</h1>
					<p className="text-sm text-surface-on-variant">
						{t.welcome.subtitle}
					</p>
				</div>

				<div className="grid grid-cols-2 gap-4 mb-8">
					<ConnectionModeCard
						icon={Cable}
						title={t.welcome.localTitle}
						description={t.welcome.localDesc}
						hint={t.welcome.localHint}
						active={selected === "direct"}
						onClick={openDirectPicker}
						meta={
							selected === "direct" && directTarget ? (
								<p className="text-[11px] text-primary">
									{directTarget === "local"
										? t.settings.directLocalGateway
										: t.settings.directCloudGateway}
								</p>
							) : null
						}
					/>
					<ConnectionModeCard
						icon={KeyRound}
						title={t.welcome.licenseTitle}
						description={t.welcome.licenseDesc}
						hint={t.welcome.licenseHint}
						active={selected === "tenant"}
						onClick={() => setSelected("tenant")}
					/>
				</div>

				<div className="flex flex-col gap-3">
					<button
						type="button"
						disabled={!canContinue || loading}
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

			{directPickerOpen && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4">
					<div className="w-full max-w-md rounded-xl border border-card-border bg-card-bg p-5 shadow-2xl ring-1 ring-white/10 space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Cable size={15} className="text-primary" />
								<h3 className="text-sm font-semibold text-surface-on">
									{t.settings.directModalTitle}
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setDirectPickerOpen(false)}
								className="text-surface-on-variant hover:text-surface-on transition-colors"
							>
								<X size={15} />
							</button>
						</div>
						<p className="text-xs text-surface-on-variant">
							{t.settings.directSelectHint}
						</p>
						<div className="grid grid-cols-2 gap-3">
							<button
								type="button"
								onClick={() => {
									setDirectTarget("local");
									setDirectPickerOpen(false);
								}}
								className={`rounded-xl border p-4 text-left transition-all ${
									directTarget === "local"
										? "border-primary/60 bg-primary/8 ring-1 ring-primary/30"
										: "border-card-border bg-surface hover:border-primary/30"
								}`}
							>
								<div className="flex items-center gap-2 mb-1.5">
									<HardDrive size={14} className="text-primary" />
									<span className="text-sm font-medium text-surface-on">
										{t.settings.directLocalGateway}
									</span>
								</div>
								<p className="text-xs text-surface-on-variant">
									{t.settings.directLocalDesc}
								</p>
							</button>
							<button
								type="button"
								onClick={() => setDirectTarget("cloud")}
								className={`rounded-xl border p-4 text-left transition-all ${
									directTarget === "cloud"
										? "border-primary/60 bg-primary/8 ring-1 ring-primary/30"
										: "border-card-border bg-surface hover:border-primary/30"
								}`}
							>
								<div className="flex items-center gap-2 mb-1.5">
									<Server size={14} className="text-primary" />
									<span className="text-sm font-medium text-surface-on">
										{t.settings.directCloudGateway}
									</span>
								</div>
								<p className="text-xs text-surface-on-variant">
									{t.settings.directCloudDesc}
								</p>
							</button>
						</div>
						{directTarget === "cloud" && (
							<div className="space-y-2">
								<label className="text-xs text-surface-on-variant block">
									{t.settings.cloudGatewayAddr}
								</label>
								<input
									value={directAddress}
									onChange={(e) => setDirectAddress(e.target.value)}
									placeholder={t.settings.cloudGatewayAddrPlaceholder}
									className="w-full px-3 py-2 text-sm rounded-lg border border-white/15 bg-surface-variant text-surface-on placeholder:text-surface-on-variant/60 focus:outline-none focus:ring-1 focus:ring-white/20"
									autoComplete="off"
								/>
								<Button
									className="w-full"
									disabled={!directAddress.trim()}
									onClick={() => setDirectPickerOpen(false)}
								>
									{t.welcome.continue}
								</Button>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

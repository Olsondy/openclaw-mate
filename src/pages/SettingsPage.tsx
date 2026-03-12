import { invoke } from "@tauri-apps/api/core";
import {
	AlertCircle,
	Cable,
	Cpu,
	Eye,
	Globe,
	HardDrive,
	KeyRound,
	Languages,
	Loader2,
	Monitor,
	Moon,
	Palette,
	Power,
	RotateCw,
	Server,
	Shield,
	Sun,
	TriangleAlert,
	Unplug,
	X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ApiWizard } from "../components/features/wizard/ApiWizard";
import { TopBar } from "../components/layout/TopBar";
import { Button, Card, Switch } from "../components/ui";
import { useNodeConnection } from "../hooks/useNodeConnection";
import type { Locale, Theme } from "../i18n";
import { useI18nStore, useT } from "../i18n";
import { makeLogId } from "../lib/activity-log";
import { useConfigStore, useConnectionStore, useTasksStore } from "../store";
import type { LogLevel } from "../types";

function maskLicenseKey(key: string): string {
	const parts = key.split("-");
	if (parts.length === 4) return `${parts[0]}-****-****-${parts[3]}`;
	return `${key.slice(0, 4)}****`;
}

function normalizeGatewayEndpoint(raw: string): {
	gatewayUrl: string;
	gatewayWebUI: string;
} {
	const value = raw.trim().replace(/\/+$/, "");
	if (/^wss?:\/\//i.test(value)) {
		return {
			gatewayUrl: value,
			gatewayWebUI: value.replace(/^ws/i, "http"),
		};
	}
	if (/^https?:\/\//i.test(value)) {
		return {
			gatewayUrl: value.replace(/^http/i, "ws"),
			gatewayWebUI: value,
		};
	}
	return {
		gatewayUrl: `wss://${value}`,
		gatewayWebUI: `https://${value}`,
	};
}

function SectionHeader({ title }: { title: string }) {
	return (
		<h2 className="text-xs font-semibold text-surface-on-variant uppercase tracking-wider px-1 mb-2">
			{title}
		</h2>
	);
}

/* THEMES & MODE_LABEL moved inside component to access `t` */

export function SettingsPage() {
	const {
		licenseKey,
		expiryDate,
		setLicenseKey,
		capabilities,
		toggleCapability,
		approvalRules,
		setApprovalRule,
		connectionMode,
		setConnectionMode,
		directMode,
		setDirectMode,
		directCloudAddress,
		setDirectCloudAddress,
		runtimeConfig,
	} = useConfigStore();
	const { status, errorMessage, setStatus } = useConnectionStore();
	const { verifyAndConnect, connectDirectGateway } = useNodeConnection();
	const addClientLog = useTasksStore((s) => s.addClientLog);
	const t = useT();
	const { locale, theme, setLocale, setTheme } = useI18nStore();

	const [newKey, setNewKey] = useState("");
	const [showConfirmKey, setShowConfirmKey] = useState(false);
	const [licenseModalOpen, setLicenseModalOpen] = useState(false);
	const [directModalOpen, setDirectModalOpen] = useState(false);
	const [directTarget, setDirectTarget] = useState<"cloud" | null>(null);
	const [directAddress, setDirectAddress] = useState(directCloudAddress);
	const [directToken, setDirectToken] = useState("");
	const [directLoading, setDirectLoading] = useState(false);
	const [directActionLoading, setDirectActionLoading] = useState<
		| "local-connect"
		| "local-stop"
		| "local-restart"
		| "cloud-disconnect"
		| "cloud-restart"
		| null
	>(null);
	const [apiWizardOpen, setApiWizardOpen] = useState(false);

	const isLoading = status === "auth_checking" || status === "connecting";
	const isOnline = status === "online";
	const hasKey = Boolean(licenseKey);
	const isDirectConnected = connectionMode === "local" && isOnline;
	const isLocalConnected = isDirectConnected && directMode === "local";
	const isCloudConnected = isDirectConnected && directMode === "cloud";
	const directBusy = directLoading || directActionLoading !== null;

	const THEMES: { key: Theme; label: string; icon: React.ElementType }[] = [
		{ key: "light", label: t.settings.themeLight, icon: Sun },
		{ key: "dark", label: t.settings.themeDark, icon: Moon },
		{ key: "system", label: t.settings.themeSystem, icon: Monitor },
	];
	const capabilityItems = [
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

	const addDirectActionLog = (
		level: LogLevel,
		title: string,
		description: string,
		tags: string[],
	) => {
		addClientLog({
			id: makeLogId("mate"),
			timestamp: new Date(),
			task_id: "",
			source: "mate",
			level,
			title,
			description,
			tags,
		});
	};

	const sleep = (ms: number) =>
		new Promise<void>((resolve) => {
			setTimeout(resolve, ms);
		});

	const connectDiscoveredLocalGateway = async () => {
		const result = await invoke<{
			gateway_url: string;
			gateway_web_ui: string;
			token: string;
		}>("local_connect");
		const ok = await connectDirectGateway({
			gatewayUrl: result.gateway_url,
			gatewayWebUI: result.gateway_web_ui,
			gatewayToken: result.token,
			profileLabel: t.settings.directLocalGateway,
		});
		if (!ok) {
			const reason =
				useConnectionStore.getState().errorMessage || t.localConnect.errorMsg;
			throw new Error(reason);
		}
	};

	const recoverAndConnectLocalGateway = async () => {
		try {
			await connectDiscoveredLocalGateway();
			return;
		} catch (initialError) {
			addDirectActionLog(
				"warning",
				"Mate: Local direct initial connect failed",
				String(initialError),
				["mate", "connection", "local", "recover", "initial-failed"],
			);
			let lastError: unknown = initialError;
			for (const action of ["start", "restart"] as const) {
				try {
					const actionMessage =
						action === "start"
							? t.settings.actionLocalStarting
							: t.settings.actionLocalRestarting;
					toast.message(actionMessage);
					addDirectActionLog(
						"warning",
						`Mate: Local direct auto-recover (${action})`,
						actionMessage,
						["mate", "connection", "local", "recover", action],
					);
					await invoke("local_gateway_daemon", { action });
					await sleep(1200);
					await connectDiscoveredLocalGateway();
					addDirectActionLog(
						"success",
						`Mate: Local direct auto-recover succeeded (${action})`,
						t.localConnect.connected,
						["mate", "connection", "local", "recover", action, "success"],
					);
					return;
				} catch (error) {
					lastError = error;
					addDirectActionLog(
						"warning",
						`Mate: Local direct auto-recover failed (${action})`,
						String(error),
						["mate", "connection", "local", "recover", action, "failed"],
					);
				}
			}
			throw lastError instanceof Error
				? lastError
				: new Error(String(lastError));
		}
	};

	const doActivate = async () => {
		setShowConfirmKey(false);
		setLicenseKey(newKey.trim());
		await invoke("save_app_config", {
			config: { connectionMode: "license" },
		});
		setConnectionMode("license");
		await verifyAndConnect();
	};

	const handleLicenseCardClick = () => {
		setLicenseModalOpen(true);
	};

	const handleDirectCardClick = () => {
		setDirectTarget(null);
		setDirectAddress(directCloudAddress);
		setDirectModalOpen(true);
	};

	const closeDirectModalSuccess = (msg: string) => {
		toast.success(msg);
		setDirectModalOpen(false);
	};

	const disconnectGatewaySession = async () => {
		await invoke("disconnect_gateway");
		await invoke("op_disconnect").catch(() => {});
		setStatus("idle");
	};

	const doConnectDirectCloud = async () => {
		if (!directAddress.trim()) return;
		setDirectLoading(true);
		try {
			toast.message(t.settings.actionCloudConnecting);
			const normalized = normalizeGatewayEndpoint(directAddress);
			const ok = await connectDirectGateway({
				gatewayUrl: normalized.gatewayUrl,
				gatewayWebUI: normalized.gatewayWebUI,
				gatewayToken: directToken.trim(),
				profileLabel: "Direct Cloud",
			});
			if (!ok) return;
			setDirectMode("cloud");
			setDirectCloudAddress(directAddress.trim());
			await invoke("save_app_config", {
				config: { connectionMode: "local" },
			});
			setConnectionMode("local");
			closeDirectModalSuccess(t.settings.actionCloudConnected);
		} finally {
			setDirectLoading(false);
		}
	};

	const handleLocalStop = async () => {
		setDirectActionLoading("local-stop");
		try {
			toast.message(t.settings.actionLocalStopping);
			await invoke("local_gateway_daemon", { action: "stop" });
			await disconnectGatewaySession();
			setDirectMode("local");
			closeDirectModalSuccess(t.settings.actionLocalStopped);
		} catch (e) {
			toast.error(String(e));
		} finally {
			setDirectActionLoading(null);
		}
	};

	const handleLocalConnect = async () => {
		setDirectActionLoading("local-connect");
		try {
			toast.message(t.localConnect.connecting);
			addDirectActionLog(
				"info",
				"Mate: Local direct connect preparing",
				t.localConnect.connecting,
				["mate", "connection", "local", "precheck"],
			);
			await recoverAndConnectLocalGateway();
			setDirectMode("local");
			await invoke("save_app_config", {
				config: { connectionMode: "local" },
			});
			setConnectionMode("local");
			closeDirectModalSuccess(t.localConnect.connected);
		} catch (e) {
			const msg = String(e);
			toast.error(msg);
			addDirectActionLog(
				"error",
				"Mate: Local direct connect failed",
				msg || "Unknown error",
				["mate", "connection", "local", "failed"],
			);
		} finally {
			setDirectActionLoading(null);
		}
	};

	const handleLocalRestart = async () => {
		setDirectActionLoading("local-restart");
		try {
			toast.message(t.settings.actionLocalRestarting);
			addDirectActionLog(
				"info",
				"Mate: Local gateway restart requested",
				t.settings.actionLocalRestarting,
				["mate", "connection", "local", "restart"],
			);
			await invoke("local_gateway_daemon", { action: "restart" });
			const result = await invoke<{
				gateway_url: string;
				gateway_web_ui: string;
				token: string;
			}>("local_connect");
			const ok = await connectDirectGateway({
				gatewayUrl: result.gateway_url,
				gatewayWebUI: result.gateway_web_ui,
				gatewayToken: result.token,
				profileLabel: "Direct Local",
			});
			if (!ok) return;
			setDirectMode("local");
			await invoke("save_app_config", {
				config: { connectionMode: "local" },
			});
			setConnectionMode("local");
			closeDirectModalSuccess(t.settings.actionLocalRestarted);
		} catch (e) {
			const msg = String(e);
			toast.error(msg);
			addDirectActionLog(
				"error",
				"Mate: Local gateway restart failed",
				msg || "Unknown error",
				["mate", "connection", "local", "restart", "failed"],
			);
		} finally {
			setDirectActionLoading(null);
		}
	};

	const handleCloudDisconnect = async () => {
		setDirectActionLoading("cloud-disconnect");
		try {
			toast.message(t.settings.actionCloudDisconnecting);
			addDirectActionLog(
				"info",
				"Mate: Cloud direct disconnect requested",
				t.settings.actionCloudDisconnecting,
				["mate", "connection", "cloud", "disconnect"],
			);
			await disconnectGatewaySession();
			closeDirectModalSuccess(t.settings.actionCloudDisconnected);
		} catch (e) {
			const msg = String(e);
			toast.error(msg);
			addDirectActionLog(
				"error",
				"Mate: Cloud direct disconnect failed",
				msg || "Unknown error",
				["mate", "connection", "cloud", "disconnect", "failed"],
			);
		} finally {
			setDirectActionLoading(null);
		}
	};

	const handleCloudRestart = async () => {
		setDirectActionLoading("cloud-restart");
		try {
			toast.message(t.settings.actionCloudRestarting);
			const currentAddr = directAddress.trim() || directCloudAddress.trim();
			if (!currentAddr) {
				toast.error(t.settings.cloudGatewayAddrRequired);
				return;
			}
			const normalized = normalizeGatewayEndpoint(currentAddr);
			const token = directToken.trim() || runtimeConfig?.gatewayToken || "";
			const ok = await connectDirectGateway({
				gatewayUrl: normalized.gatewayUrl,
				gatewayWebUI: normalized.gatewayWebUI,
				gatewayToken: token,
				profileLabel: "Direct Cloud",
			});
			if (!ok) return;
			setDirectMode("cloud");
			setDirectCloudAddress(currentAddr);
			await invoke("save_app_config", {
				config: { connectionMode: "local" },
			});
			setConnectionMode("local");
			closeDirectModalSuccess(t.settings.actionCloudRestarted);
		} catch (e) {
			toast.error(String(e));
		} finally {
			setDirectActionLoading(null);
		}
	};

	const inputClass =
		"w-full px-3 py-2 text-sm rounded-lg border border-white/15 bg-surface-variant text-surface-on placeholder:text-surface-on-variant/60 focus:outline-none focus:ring-1 focus:ring-white/20 font-mono tracking-wider";

	const selectClass =
		"text-sm px-2 py-1 rounded-lg border border-white/15 bg-surface-variant text-surface-on focus:outline-none";
	const activeModeCardClass =
		"border-primary/60 bg-primary/8 ring-1 ring-primary/30 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)]";

	return (
		<>
			<TopBar title={t.sidebar.settings} />
			<div className="flex-1 overflow-auto p-6 space-y-6 max-w-2xl">
				{/* ── 连接方式 ── */}
				<section>
					<SectionHeader title={t.settings.sectionConnection} />

					{/* 两个连接卡片 */}
					<div className="grid grid-cols-2 gap-3">
						{/* 本地 卡片 */}
						<button
							type="button"
							onClick={handleDirectCardClick}
							className={`group relative flex flex-col items-center justify-center text-left rounded-xl border p-3 transition-all duration-300 min-h-[80px] ${
								connectionMode === "local" && isOnline
									? activeModeCardClass
									: "border-card-border bg-card-bg hover:border-primary/30 hover:-translate-y-1 hover:shadow-md"
							}`}
						>
							{connectionMode === "local" && isOnline && (
								<span className="absolute top-3 right-3 flex h-2.5 w-2.5">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
									<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
								</span>
							)}
							<div className="flex items-center gap-1.5">
								{" "}
								<Cable
									size={15}
									className={
										connectionMode === "local" && isOnline
											? "text-primary"
											: "text-surface-on-variant"
									}
								/>
								<span className="text-sm font-medium text-surface-on">
									{t.settings.local}
								</span>
							</div>
							{connectionMode === "local" && isOnline && directMode && (
								<p className="mt-1 text-[11px] text-primary font-medium">
									{directMode === "local"
										? t.settings.directLocalGateway
										: t.settings.directCloudGateway}
								</p>
							)}
						</button>

						{/* License 卡片 */}
						<button
							type="button"
							onClick={handleLicenseCardClick}
							className={`group relative flex flex-col items-center justify-center text-left rounded-xl border p-3 transition-all duration-300 min-h-[80px] ${
								connectionMode === "license" && isOnline
									? activeModeCardClass
									: "border-card-border bg-card-bg hover:border-primary/30 hover:-translate-y-1 hover:shadow-md"
							}`}
						>
							{connectionMode === "license" && isOnline && (
								<span className="absolute top-3 right-3 flex h-2.5 w-2.5">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
									<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
								</span>
							)}
							<div className="flex items-center gap-1.5">
								<Server
									size={15}
									className={
										connectionMode === "license" && isOnline
											? "text-primary"
											: "text-surface-on-variant"
									}
								/>
								<span className="text-sm font-medium text-surface-on">
									{t.settings.cloud}
								</span>
							</div>
							{connectionMode === "license" && isOnline && hasKey && (
								<div className="space-y-1 mt-1.5 w-full">
									<div className="flex justify-between text-[11px]">
										<span className="text-surface-on-variant">
											{t.settings.keyLabel}
										</span>
										<span className="font-mono text-surface-on">
											{maskLicenseKey(licenseKey)}
										</span>
									</div>
									<div className="flex justify-between text-[11px]">
										<span className="text-surface-on-variant">
											{t.settings.expiryLabel}
										</span>
										<span className="text-surface-on">
											{expiryDate === "Permanent" || !expiryDate
												? t.settings.expiryPermanent
												: expiryDate}
										</span>
									</div>
								</div>
							)}
						</button>
					</div>
				</section>

				{/* ── 节点配置 ── */}
				<section>
					<SectionHeader title={t.settings.sectionNode} />

					{/* 模型 API */}
					<div className="relative mb-3">
						<Card>
							<div className="flex items-center gap-2 mb-3">
								<Cpu size={15} className="text-primary" />
								<span className="text-sm font-medium text-surface-on">
									{t.settings.apiConfig}
								</span>
							</div>
							<p className="text-xs text-surface-on-variant mb-3">
								{t.settings.apiConfigDesc}
							</p>
							<Button variant="outlined" onClick={() => setApiWizardOpen(true)}>
								{t.settings.openWizard}
							</Button>
						</Card>
					</div>

					{/* 节点能力 */}
					<Card className="mb-3">
						<div className="flex items-center gap-2 mb-2">
							<Cpu size={15} className="text-primary" />
							<span className="text-sm font-medium text-surface-on">
								{t.settings.capabilitiesTitle}
							</span>
						</div>
						<p className="text-xs text-surface-on-variant mb-3">
							{t.settings.capabilitiesDesc}
						</p>
						<div className="space-y-3">
							{capabilityItems.map(
								({ key, icon: Icon, title, description }) => (
									<div
										key={key}
										className="rounded-lg border border-white/10 p-3"
									>
										<div className="flex items-start justify-between gap-3">
											<div className="flex items-start gap-2.5">
												<Icon
													size={15}
													className="text-primary mt-0.5 shrink-0"
												/>
												<div>
													<p className="text-sm text-surface-on font-medium">
														{title}
													</p>
													<p className="text-xs text-surface-on-variant mt-0.5">
														{description}
													</p>
												</div>
											</div>
											<Switch
												checked={capabilities[key]}
												onChange={() => toggleCapability(key)}
											/>
										</div>
									</div>
								),
							)}
						</div>
					</Card>

					{/* 审批规则 */}
					<Card>
						<div className="flex items-center gap-2 mb-3">
							<Shield size={15} className="text-primary" />
							<span className="text-sm font-medium text-surface-on">
								{t.settings.approvalRules}
							</span>
						</div>
						<div className="space-y-3">
							{(["browser", "system", "vision"] as const).map((key) => (
								<div key={key} className="flex items-center justify-between">
									<span className="text-sm text-surface-on">
										{key === "browser"
											? t.settings.approvalBrowser
											: key === "system"
												? t.settings.approvalSystem
												: t.settings.approvalVision}
									</span>
									<select
										value={approvalRules[key]}
										onChange={(e) =>
											setApprovalRule(
												key,
												e.target.value as "always" | "never" | "sensitive_only",
											)
										}
										className={selectClass}
									>
										<option value="always">{t.settings.always}</option>
										<option value="sensitive_only">
											{t.settings.sensitiveOnly}
										</option>
										<option value="never">{t.settings.never}</option>
									</select>
								</div>
							))}
						</div>
					</Card>
				</section>

				{/* ── 偏好设置 ── */}
				<section>
					<SectionHeader title={t.settings.sectionPreferences} />
					<Card>
						<div className="flex items-center gap-2 mb-4">
							<Palette size={15} className="text-primary" />
							<span className="text-sm font-medium text-surface-on">
								{t.settings.appearance}
							</span>
						</div>

						{/* 语言 */}
						<div className="mb-4">
							<div className="flex items-center gap-2 mb-2">
								<Languages size={13} className="text-surface-on-variant" />
								<span className="text-xs text-surface-on-variant">
									{t.settings.language}
								</span>
							</div>
							<div className="flex gap-2">
								{(["zh", "en"] as Locale[]).map((loc) => (
									<button
										key={loc}
										type="button"
										onClick={() => setLocale(loc)}
										className={`px-4 py-1.5 text-sm rounded-lg border transition-all ${
											locale === loc
												? "border-primary bg-primary/5 text-primary font-medium"
												: "border-white/15 text-surface-on-variant hover:text-surface-on"
										}`}
									>
										{loc === "zh" ? t.settings.localeZh : t.settings.localeEn}
									</button>
								))}
							</div>
						</div>

						{/* 主题 */}
						<div>
							<div className="flex items-center gap-2 mb-2">
								<Sun size={13} className="text-surface-on-variant" />
								<span className="text-xs text-surface-on-variant">
									{t.settings.themeColor}
								</span>
							</div>
							<div className="flex gap-2">
								{THEMES.map(({ key, label, icon: Icon }) => (
									<button
										key={key}
										type="button"
										onClick={() => setTheme(key)}
										className={`flex items-center gap-2 px-4 py-1.5 text-sm rounded-lg border transition-all ${
											theme === key
												? "border-primary bg-primary/5 text-primary font-medium"
												: "border-white/15 text-surface-on-variant hover:text-surface-on"
										}`}
									>
										<Icon size={14} />
										{label}
									</button>
								))}
							</div>
						</div>
					</Card>
				</section>
			</div>

			{/* ── License 操作弹窗 ── */}
			{licenseModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="w-80 bg-card-bg border border-card-border rounded-xl p-5 shadow-2xl ring-1 ring-white/10 space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<KeyRound size={15} className="text-primary" />
								<h3 className="text-sm font-semibold text-surface-on">
									{t.settings.licenseModalTitle}
								</h3>
							</div>
							<button
								type="button"
								onClick={() => {
									setLicenseModalOpen(false);
									setNewKey("");
								}}
								className="text-surface-on-variant hover:text-surface-on transition-colors"
							>
								<X size={15} />
							</button>
						</div>

						{hasKey && (
							<div className="rounded-lg border border-white/8 bg-surface px-3 py-2.5 space-y-1.5">
								<div className="flex justify-between text-xs">
									<span className="text-surface-on-variant">
										{t.settings.currentKeyLabel}
									</span>
									<span className="font-mono text-surface-on">
										{maskLicenseKey(licenseKey)}
									</span>
								</div>
								<div className="flex justify-between text-xs">
									<span className="text-surface-on-variant">
										{t.settings.expiryTimeLabel}
									</span>
									<span className="text-surface-on">
										{expiryDate === "Permanent" || !expiryDate
											? t.settings.expiryPermanent
											: expiryDate}
									</span>
								</div>
							</div>
						)}

						<div>
							<label className="text-xs text-surface-on-variant mb-1.5 block">
								{hasKey ? t.settings.changeKey : t.settings.licenseKeyLabel}
							</label>
							<input
								type="text"
								value={newKey}
								onChange={(e) => setNewKey(e.target.value)}
								placeholder={t.settings.licenseKeyPlaceholder}
								className={inputClass}
								autoComplete="off"
								spellCheck={false}
							/>
						</div>

						{errorMessage && (
							<div className="flex items-start gap-2 p-3 rounded-lg bg-error-container text-error-on-container text-xs">
								<AlertCircle size={13} className="mt-0.5 shrink-0" />
								<span>{errorMessage}</span>
							</div>
						)}

						<Button
							onClick={() => (hasKey ? setShowConfirmKey(true) : doActivate())}
							disabled={isLoading || !newKey.trim()}
							className="w-full"
						>
							{isLoading ? (
								<span className="flex items-center gap-2">
									<Loader2 size={13} className="animate-spin" />
									{status === "auth_checking"
										? t.settings.verifying
										: t.settings.connecting}
								</span>
							) : hasKey ? (
								t.settings.changeAndActivate
							) : (
								t.settings.verifyAndActivate
							)}
						</Button>
					</div>
				</div>
			)}

			{/* ── 直连弹窗 ── */}
			{directModalOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="w-[460px] bg-card-bg border border-card-border rounded-xl p-5 shadow-2xl ring-1 ring-white/10 space-y-4">
						<div className="flex items-center justify-between mb-4">
							<div className="flex items-center gap-2">
								<Cable size={15} className="text-primary" />
								<h3 className="text-sm font-semibold text-surface-on">
									{t.settings.directModalTitle}
								</h3>
							</div>
							<button
								type="button"
								onClick={() => setDirectModalOpen(false)}
								className="text-surface-on-variant hover:text-surface-on transition-colors"
							>
								<X size={15} />
							</button>
						</div>

						{directTarget === null && (
							<div className="space-y-3">
								<p className="text-xs text-surface-on-variant">
									{t.settings.directSelectHint}
								</p>
								<div className="grid grid-cols-2 gap-3">
									<div
										className={`rounded-xl border bg-surface flex flex-col transition-all duration-300 ${
											isLocalConnected
												? activeModeCardClass
												: "border-card-border hover:border-primary/30 hover:-translate-y-1 hover:shadow-md"
										}`}
									>
										<button
											type="button"
											onClick={() => {
												if (!isLocalConnected) {
													handleLocalConnect();
												}
											}}
											disabled={directBusy}
											className={`w-full p-4 text-center rounded-xl ${
												isLocalConnected
													? ""
													: "flex-1 flex flex-col justify-center"
											}`}
										>
											<div className="flex items-center justify-center gap-2 mb-1.5">
												<div className="flex items-center gap-2">
													<HardDrive size={14} className="text-primary" />
													<span className="text-sm font-medium text-surface-on">
														{t.settings.directLocalGateway}
													</span>
													{isLocalConnected && (
														<span className="relative flex h-2.5 w-2.5">
															<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
															<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
														</span>
													)}
												</div>
											</div>
											<p className="text-xs text-surface-on-variant text-center">
												{t.settings.directLocalDesc}
											</p>
											{directActionLoading === "local-connect" && (
												<div className="mt-2 flex items-center justify-center text-xs text-surface-on-variant gap-1.5">
													<Loader2 size={12} className="animate-spin" />
													<span>{t.localConnect.connecting}</span>
												</div>
											)}
										</button>
										{isLocalConnected && (
											<div className="px-4 pb-4 pt-1 space-y-2">
												<div className="flex gap-2">
													<Button
														size="sm"
														variant="outlined"
														className="flex-1"
														onClick={handleLocalStop}
														disabled={directBusy}
													>
														{directActionLoading === "local-stop" ? (
															<Loader2 size={12} className="animate-spin" />
														) : (
															<Power size={12} />
														)}
														<span className="ml-1">{t.settings.localStop}</span>
													</Button>
													<Button
														size="sm"
														variant="outlined"
														className="flex-1"
														onClick={handleLocalRestart}
														disabled={directBusy}
													>
														{directActionLoading === "local-restart" ? (
															<Loader2 size={12} className="animate-spin" />
														) : (
															<RotateCw size={12} />
														)}
														<span className="ml-1">
															{t.settings.localRestart}
														</span>
													</Button>
												</div>
											</div>
										)}
									</div>

									<div
										className={`rounded-xl border bg-surface flex flex-col transition-all duration-300 ${
											isCloudConnected
												? activeModeCardClass
												: "border-card-border hover:border-primary/30 hover:-translate-y-1 hover:shadow-md"
										}`}
									>
										<button
											type="button"
											onClick={() => {
												setDirectTarget("cloud");
											}}
											className={`w-full p-4 text-center rounded-xl ${
												isCloudConnected
													? ""
													: "flex-1 flex flex-col justify-center"
											}`}
										>
											<div className="flex items-center justify-center gap-2 mb-1.5">
												<div className="flex items-center gap-2">
													<Globe size={14} className="text-primary" />
													<span className="text-sm font-medium text-surface-on">
														{t.settings.directCloudGateway}
													</span>
													{isCloudConnected && (
														<span className="relative flex h-2.5 w-2.5">
															<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
															<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
														</span>
													)}
												</div>
											</div>
											<p className="text-xs text-surface-on-variant text-center">
												{t.settings.directCloudDesc}
											</p>
										</button>
										{isCloudConnected && (
											<div className="px-4 pb-4 pt-1 space-y-2">
												{directCloudAddress && (
													<p className="text-[11px] font-mono text-surface-on-variant truncate">
														{directCloudAddress}
													</p>
												)}
												<div className="flex gap-2">
													<Button
														size="sm"
														variant="outlined"
														className="flex-1"
														onClick={handleCloudDisconnect}
														disabled={directBusy}
													>
														{directActionLoading === "cloud-disconnect" ? (
															<Loader2 size={12} className="animate-spin" />
														) : (
															<Unplug size={12} />
														)}
														<span className="ml-1">
															{t.settings.cloudDisconnect}
														</span>
													</Button>
													<Button
														size="sm"
														variant="outlined"
														className="flex-1"
														onClick={handleCloudRestart}
														disabled={directBusy}
													>
														{directActionLoading === "cloud-restart" ? (
															<Loader2 size={12} className="animate-spin" />
														) : (
															<RotateCw size={12} />
														)}
														<span className="ml-1">
															{t.settings.cloudRestart}
														</span>
													</Button>
												</div>
											</div>
										)}
									</div>
								</div>
							</div>
						)}

						{directTarget === "cloud" && (
							<div className="space-y-3">
								<button
									type="button"
									onClick={() => setDirectTarget(null)}
									className="text-xs text-surface-on-variant hover:text-surface-on transition-colors"
								>
									{t.settings.backToSelect}
								</button>
								{isCloudConnected && (
									<div className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-500 space-y-1.5">
										<div className="flex items-center gap-2">
											<span>{t.settings.actionCloudConnected}</span>
										</div>
										{directCloudAddress && (
											<p className="font-mono text-[11px] text-surface-on truncate">
												{directCloudAddress}
											</p>
										)}
									</div>
								)}
								<div>
									<label className="text-xs text-surface-on-variant mb-1.5 block">
										{t.settings.cloudGatewayAddr}
									</label>
									<input
										type="text"
										value={directAddress}
										onChange={(e) => setDirectAddress(e.target.value)}
										placeholder={t.settings.cloudGatewayAddrPlaceholder}
										className={`${inputClass} ${
											isCloudConnected
												? "border-green-500/50 ring-1 ring-green-500/40"
												: ""
										}`}
									/>
								</div>
								<div>
									<label className="text-xs text-surface-on-variant mb-1.5 block">
										{t.settings.cloudGatewayToken}
									</label>
									<input
										type="password"
										value={directToken}
										onChange={(e) => setDirectToken(e.target.value)}
										placeholder={t.settings.cloudGatewayTokenPlaceholder}
										className={inputClass}
									/>
								</div>
								<Button
									onClick={doConnectDirectCloud}
									disabled={directBusy || !directAddress.trim()}
									className="w-full"
								>
									{directLoading ? (
										<span className="flex items-center gap-2">
											<Loader2 size={13} className="animate-spin" />
											{t.settings.connecting}
										</span>
									) : (
										t.settings.connectNow
									)}
								</Button>
							</div>
						)}
					</div>
				</div>
			)}

			{/* ── 换 Key 确认弹窗 ── */}
			{showConfirmKey && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
					<div className="bg-card-bg border border-card-border rounded-xl shadow-2xl ring-1 ring-white/10 w-80 p-5 space-y-4">
						<div className="flex items-center gap-2">
							<TriangleAlert size={16} className="text-yellow-500" />
							<h3 className="text-sm font-semibold text-surface-on">
								{t.settings.confirmChangeKey}
							</h3>
						</div>
						<p className="text-xs text-surface-on-variant leading-relaxed">
							{t.settings.confirmChangeDesc}
						</p>
						<ul className="text-xs text-surface-on space-y-1.5 pl-1">
							{[t.settings.confirmBullet1, t.settings.confirmBullet2].map(
								(item) => (
									<li key={item} className="flex items-start gap-1.5">
										<span className="mt-0.5 text-surface-on-variant">•</span>
										<span>{item}</span>
									</li>
								),
							)}
						</ul>
						<div className="flex gap-2 pt-1">
							<Button
								variant="outlined"
								className="flex-1"
								onClick={() => setShowConfirmKey(false)}
							>
								{t.settings.cancel}
							</Button>
							<Button className="flex-1" onClick={doActivate}>
								{t.settings.confirmChange}
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* ── 模型 API 向导 ── */}
			{apiWizardOpen && (
				<ApiWizard
					onSuccess={() => {
						setApiWizardOpen(false);
					}}
					onClose={() => setApiWizardOpen(false)}
				/>
			)}
		</>
	);
}

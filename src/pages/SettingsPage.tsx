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
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConnectionModeCard } from "../components/features/connection/ConnectionModeCard";
import { ApiWizard } from "../components/features/wizard/ApiWizard";
import { TopBar } from "../components/layout/TopBar";
import { Button, Card, Select, Switch } from "../components/ui";
import { useNodeConnection } from "../hooks/useNodeConnection";
import { useTauriEvent } from "../hooks/useTauri";
import type { Locale, Theme } from "../i18n";
import { useI18nStore, useT } from "../i18n";
import { makeLogId } from "../lib/activity-log";
import { useConfigStore, useConnectionStore, useTasksStore } from "../store";
import type { ConnectionMode } from "../store/config.store";
import type { LogLevel } from "../types";

interface LicenseProfileSnapshot {
	licenseKey: string;
	licenseId?: number | null;
	gatewayEndpoint?: string;
	gatewayWebUI?: string;
	expiryDate?: string;
}

interface LocalProfileSnapshot {
	gatewayUrl: string;
	gatewayWebUI?: string;
	gatewayToken?: string | null;
	agentId?: string;
	deviceName?: string;
	lastConnectedAt?: string;
}

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

function isGatewayTokenMismatchError(message: string): boolean {
	const normalized = message.toLowerCase();
	return (
		normalized.includes("auth_token_mismatch") ||
		normalized.includes("token_mismatch") ||
		normalized.includes("gateway token mismatch")
	);
}

function isOpenclawNotInstalledError(message: string): boolean {
	const normalized = message.toLowerCase();
	return (
		normalized.includes("openclaw_not_installed") ||
		normalized.includes("未安装 openclaw") ||
		normalized.includes("openclaw cli 未安装")
	);
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
		licenseId,
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
		resetForModeSwitch,
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
	const [directStatus, setDirectStatus] = useState<{
		level: "info" | "error";
		message: string;
	} | null>(null);
	const [directActionLoading, setDirectActionLoading] = useState<
		| "local-connect"
		| "local-stop"
		| "local-restart"
		| "cloud-disconnect"
		| "cloud-restart"
		| null
	>(null);
	const [openclawInstallLoading, setOpenclawInstallLoading] = useState(false);
	const [downloadProgress, setDownloadProgress] = useState<{
		percent: number;
		downloaded: number;
		total: number;
	} | null>(null);
	const [switchModeRequest, setSwitchModeRequest] = useState<{
		fromMode: ConnectionMode;
		toMode: ConnectionMode;
		openTarget: "tenant" | "direct";
	} | null>(null);
	const [switchModeLoading, setSwitchModeLoading] = useState(false);
	const [cachedLicenseProfile, setCachedLicenseProfile] =
		useState<LicenseProfileSnapshot | null>(null);
	const [cachedLocalProfile, setCachedLocalProfile] =
		useState<LocalProfileSnapshot | null>(null);
	const [apiWizardOpen, setApiWizardOpen] = useState(false);

	const isLoading = status === "auth_checking" || status === "connecting";
	const isOnline = status === "online";
	const hasKey = Boolean(licenseKey);
	const isDirectConnected = connectionMode === "direct" && isOnline;
	const isLocalConnected = isDirectConnected && directMode === "local";
	const isCloudConnected = isDirectConnected && directMode === "cloud";
	const directBusy =
		directLoading || directActionLoading !== null || openclawInstallLoading;

	useTauriEvent<{ percent: number; downloaded: number; total: number }>(
		"runtime:download-progress",
		useCallback((payload) => {
			setDownloadProgress(payload);
		}, []),
	);

	const isLoopbackGateway = useCallback((endpoint: string): boolean => {
		const raw = endpoint.trim();
		if (!raw) return false;
		const withScheme = /^wss?:\/\//i.test(raw)
			? raw
			: /^https?:\/\//i.test(raw)
				? raw.replace(/^http/i, "ws")
				: `ws://${raw}`;
		try {
			const host = new URL(withScheme).hostname.toLowerCase();
			return host === "127.0.0.1" || host === "localhost";
		} catch {
			return false;
		}
	}, []);

	const loadCachedProfiles = useCallback(async () => {
		const [licenseProfileRaw, localProfileRaw] = await Promise.all([
			invoke<LicenseProfileSnapshot | null>("get_license_profile").catch(
				() => null,
			),
			invoke<LocalProfileSnapshot | null>("get_local_profile").catch(
				() => null,
			),
		]);
		const licenseProfile = licenseProfileRaw ?? null;
		const localProfile = localProfileRaw ?? null;
		setCachedLicenseProfile(licenseProfile);
		setCachedLocalProfile(localProfile);
		return { licenseProfile, localProfile };
	}, []);

	useEffect(() => {
		void loadCachedProfiles();
	}, [loadCachedProfiles]);

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

	const applyDirectProfileDraft = (profile: LocalProfileSnapshot | null) => {
		if (!profile) return;
		const endpoint = (profile.gatewayUrl || profile.gatewayWebUI || "").trim();
		if (!endpoint) return;
		if (isLoopbackGateway(endpoint)) {
			setDirectTarget(null);
			return;
		}
		setDirectTarget("cloud");
		setDirectAddress(endpoint);
		setDirectToken(profile.gatewayToken?.trim() ?? "");
	};

	const persistSwitchSourceProfile = async (fromMode: ConnectionMode) => {
		if (fromMode === "tenant" && licenseKey.trim()) {
			await invoke("save_license_profile", {
				profile: {
					licenseKey: licenseKey.trim(),
					licenseId: licenseId ?? null,
					gatewayEndpoint: runtimeConfig?.gatewayUrl ?? "",
					gatewayWebUI: runtimeConfig?.gatewayWebUI ?? "",
					expiryDate,
					modelConfigSnapshot: null,
					approvalRules: approvalRules as unknown as Record<string, string>,
				},
			});
			return;
		}
		if (fromMode === "direct" && runtimeConfig) {
			await invoke("save_local_profile", {
				profile: {
					gatewayUrl: runtimeConfig.gatewayUrl,
					gatewayWebUI: runtimeConfig.gatewayWebUI,
					gatewayToken: runtimeConfig.gatewayToken || null,
					agentId: runtimeConfig.agentId,
					deviceName: runtimeConfig.deviceName,
					lastConnectedAt: new Date().toISOString(),
				},
			});
		}
	};

	const connectDiscoveredLocalGateway = async () => {
		const result = await invoke<{
			gateway_url: string;
			gateway_web_ui: string;
			token: string;
			restart_log?: string | null;
		}>("local_connect");
		if (result.restart_log?.trim()) {
			addDirectActionLog(
				"info",
				"Mate: Local gateway auto-start",
				result.restart_log,
				["mate", "connection", "local", "service", "start", "auto"],
			);
		}
		addDirectActionLog(
			"info",
			"Mate: Local gateway discovered",
			result.gateway_url,
			["mate", "connection", "local", "probe", "ok"],
		);
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
		addDirectActionLog(
			"success",
			"Mate: Local direct connected",
			result.gateway_url,
			["mate", "connection", "local", "connected"],
		);
	};

	const doActivate = async () => {
		setShowConfirmKey(false);
		const nextKey = newKey.trim();
		setLicenseKey(nextKey);
		await invoke("save_app_config", {
			config: { connectionMode: "tenant" },
		});
		setConnectionMode("tenant");
		await verifyAndConnect(nextKey);
	};

	const openDirectModal = () => {
		setDirectTarget(null);
		setDirectAddress(directCloudAddress);
		setDirectStatus(null);
		setDirectModalOpen(true);
	};

	const handleLicenseCardClick = async () => {
		if (connectionMode === "direct" && isOnline) {
			setSwitchModeRequest({
				fromMode: "direct",
				toMode: "tenant",
				openTarget: "tenant",
			});
			return;
		}
		let profile = cachedLicenseProfile;
		if (!profile) {
			const loaded = await loadCachedProfiles();
			profile = loaded.licenseProfile;
		}
		if (profile?.licenseKey && !newKey.trim()) {
			setNewKey(profile.licenseKey);
		}
		setLicenseModalOpen(true);
	};

	const handleDirectCardClick = async () => {
		if (connectionMode === "tenant" && isOnline) {
			setSwitchModeRequest({
				fromMode: "tenant",
				toMode: "direct",
				openTarget: "direct",
			});
			return;
		}
		let profile = cachedLocalProfile;
		if (!profile) {
			const loaded = await loadCachedProfiles();
			profile = loaded.localProfile;
		}
		openDirectModal();
		applyDirectProfileDraft(profile);
	};

	const closeDirectModalSuccess = (msg: string) => {
		setDirectStatus(null);
		setDirectModalOpen(false);
		window.setTimeout(() => {
			toast.success(msg);
		}, 40);
	};

	const disconnectGatewaySession = async () => {
		await invoke("disconnect_gateway");
		await invoke("op_disconnect").catch(() => {});
		setStatus("idle");
	};

	const handleSwitchModeConfirm = async () => {
		if (!switchModeRequest) return;
		setSwitchModeLoading(true);
		const target = switchModeRequest;
		try {
			addDirectActionLog(
				"info",
				"Mate: Mode switch requested",
				`${target.fromMode} -> ${target.toMode}`,
				[
					"mate",
					"connection",
					"mode",
					"switch",
					target.fromMode,
					target.toMode,
				],
			);
			await persistSwitchSourceProfile(target.fromMode);
			await invoke("save_app_config", {
				config: { connectionMode: target.toMode },
			});
			resetForModeSwitch();
			await disconnectGatewaySession();
			setConnectionMode(target.toMode);
			const { licenseProfile, localProfile } = await loadCachedProfiles();
			addDirectActionLog(
				"success",
				"Mate: Mode switched",
				`${target.fromMode} -> ${target.toMode}`,
				[
					"mate",
					"connection",
					"mode",
					"switched",
					target.fromMode,
					target.toMode,
				],
			);
			setSwitchModeRequest(null);
			if (target.openTarget === "tenant") {
				if (licenseProfile?.licenseKey) {
					setNewKey(licenseProfile.licenseKey);
				}
				setLicenseModalOpen(true);
				return;
			}
			openDirectModal();
			applyDirectProfileDraft(localProfile);
		} catch (e) {
			const msg = String(e);
			addDirectActionLog(
				"error",
				"Mate: Mode switch failed",
				msg || "Unknown error",
				["mate", "connection", "mode", "switch", "failed"],
			);
			toast.error(msg || t.settings.switchModeConfirm);
		} finally {
			setSwitchModeLoading(false);
		}
	};

	const handleRestoreTenantConnection = async () => {
		const profile = cachedLicenseProfile;
		if (!profile?.licenseKey?.trim()) {
			toast.warning(t.settings.reconnectMissing);
			return;
		}
		setNewKey(profile.licenseKey);
		setLicenseKey(profile.licenseKey);
		await invoke("save_app_config", {
			config: { connectionMode: "tenant" },
		});
		setConnectionMode("tenant");
		addDirectActionLog(
			"info",
			"Mate: Tenant restore requested",
			profile.licenseKey,
			["mate", "connection", "tenant", "restore"],
		);
		const ok = await verifyAndConnect(profile.licenseKey);
		if (ok) {
			setLicenseModalOpen(false);
			toast.success(t.settings.actionCloudConnected);
		}
	};

	const handleRestoreDirectConnection = async () => {
		const profile = cachedLocalProfile;
		if (!profile) {
			toast.warning(t.settings.reconnectMissing);
			return;
		}
		const endpoint = (profile.gatewayUrl || profile.gatewayWebUI || "").trim();
		if (!endpoint) {
			toast.warning(t.settings.reconnectMissing);
			return;
		}
		if (isLoopbackGateway(endpoint)) {
			await handleLocalConnect();
			return;
		}
		setDirectTarget("cloud");
		setDirectAddress(endpoint);
		setDirectToken(profile.gatewayToken?.trim() ?? "");
		setDirectLoading(true);
		setDirectStatus({
			level: "info",
			message: t.settings.actionCloudConnecting,
		});
		addDirectActionLog(
			"info",
			"Mate: Direct cloud restore requested",
			endpoint,
			["mate", "connection", "cloud", "restore"],
		);
		try {
			const normalized = normalizeGatewayEndpoint(endpoint);
			const ok = await connectDirectGateway({
				gatewayUrl: normalized.gatewayUrl,
				gatewayWebUI: normalized.gatewayWebUI,
				gatewayToken: profile.gatewayToken?.trim() ?? "",
				profileLabel: t.settings.directCloudGateway,
			});
			if (!ok) return;
			setDirectMode("cloud");
			setDirectCloudAddress(endpoint);
			await invoke("save_app_config", {
				config: { connectionMode: "direct" },
			});
			setConnectionMode("direct");
			closeDirectModalSuccess(t.settings.actionCloudConnected);
		} catch (e) {
			setDirectStatus({
				level: "error",
				message: String(e),
			});
		} finally {
			setDirectLoading(false);
		}
	};

	const doConnectDirectCloud = async () => {
		if (!directAddress.trim()) return;
		setDirectLoading(true);
		setDirectStatus({
			level: "info",
			message: t.settings.actionCloudConnecting,
		});
		try {
			const normalized = normalizeGatewayEndpoint(directAddress);
			const ok = await connectDirectGateway({
				gatewayUrl: normalized.gatewayUrl,
				gatewayWebUI: normalized.gatewayWebUI,
				gatewayToken: directToken.trim(),
				profileLabel: t.settings.directCloudGateway,
			});
			if (!ok) return;
			setDirectMode("cloud");
			setDirectCloudAddress(directAddress.trim());
			await invoke("save_app_config", {
				config: { connectionMode: "direct" },
			});
			setConnectionMode("direct");
			closeDirectModalSuccess(t.settings.actionCloudConnected);
		} catch (e) {
			setDirectStatus({
				level: "error",
				message: String(e),
			});
		} finally {
			setDirectLoading(false);
		}
	};

	const handleLocalStop = async () => {
		setDirectActionLoading("local-stop");
		try {
			setDirectStatus({
				level: "info",
				message: t.settings.actionLocalStopping,
			});
			const daemonMessage = await invoke<string>("local_gateway_daemon", {
				action: "stop",
			});
			addDirectActionLog(
				"info",
				"Mate: Local gateway stopped",
				daemonMessage || t.settings.actionLocalStopped,
				["mate", "connection", "local", "service", "stop"],
			);
			await disconnectGatewaySession();
			setDirectMode("local");
			closeDirectModalSuccess(t.settings.actionLocalStopped);
		} catch (e) {
			setDirectStatus({
				level: "error",
				message: String(e),
			});
		} finally {
			setDirectActionLoading(null);
		}
	};

	const handleLocalConnect = async () => {
		setDirectActionLoading("local-connect");
		try {
			setDirectStatus({
				level: "info",
				message: t.localConnect.connecting,
			});
			addDirectActionLog(
				"info",
				"Mate: Local direct connect preparing",
				t.localConnect.connecting,
				["mate", "connection", "local", "precheck"],
			);
			await connectDiscoveredLocalGateway();
			setDirectMode("local");
			await invoke("save_app_config", {
				config: { connectionMode: "direct" },
			});
			setConnectionMode("direct");
			closeDirectModalSuccess(t.localConnect.connected);
		} catch (e) {
			const msg = String(e);
			if (isGatewayTokenMismatchError(msg)) {
				try {
					setDirectStatus({
						level: "info",
						message: t.settings.actionLocalRestarting,
					});
					addDirectActionLog(
						"warning",
						"Mate: Local token mismatch detected",
						msg,
						["mate", "connection", "local", "token", "mismatch"],
					);
					const daemonMessage = await invoke<string>("local_gateway_daemon", {
						action: "restart",
					});
					addDirectActionLog(
						"info",
						"Mate: Local gateway restarted after token mismatch",
						daemonMessage || t.settings.actionLocalRestarted,
						["mate", "connection", "local", "service", "restart", "recovery"],
					);
					await connectDiscoveredLocalGateway();
					setDirectMode("local");
					await invoke("save_app_config", {
						config: { connectionMode: "direct" },
					});
					setConnectionMode("direct");
					closeDirectModalSuccess(t.settings.actionLocalRestarted);
					return;
				} catch (recoverError) {
					const recoverMsg = String(recoverError);
					setDirectStatus({
						level: "error",
						message: recoverMsg,
					});
					addDirectActionLog(
						"error",
						"Mate: Local token mismatch recovery failed",
						recoverMsg || "Unknown error",
						["mate", "connection", "local", "token", "recovery", "failed"],
					);
					return;
				}
			}
			setDirectStatus({
				level: "error",
				message: msg,
			});
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

	// CDN manifest URL，部署后替换为实际地址
	const RUNTIME_MANIFEST_URL =
		"https://your-server.com/openclaw-runtime/latest/manifest.json";

	const handleInstallOpenclaw = async () => {
		setOpenclawInstallLoading(true);
		setDownloadProgress(null);
		try {
			setDirectStatus({
				level: "info",
				message: t.settings.openclawInstalling,
			});
			addDirectActionLog(
				"info",
				"Mate: Runtime download started",
				t.settings.openclawInstalling,
				["mate", "connection", "local", "install", "start"],
			);
			const installMessage = await invoke<string>(
				"download_and_install_runtime",
				{
					manifestUrl: RUNTIME_MANIFEST_URL,
				},
			);
			setDownloadProgress(null);
			addDirectActionLog(
				"success",
				"Mate: Runtime download completed",
				installMessage || t.settings.openclawInstallSuccess,
				["mate", "connection", "local", "install", "success"],
			);
			setDirectStatus({
				level: "info",
				message: t.settings.openclawInstallSuccess,
			});
			toast.success(t.settings.openclawInstallSuccess);
			await handleLocalConnect();
		} catch (e) {
			const msg = String(e);
			setDownloadProgress(null);
			setDirectStatus({
				level: "error",
				message: msg || t.settings.openclawInstallFailed,
			});
			addDirectActionLog(
				"error",
				"Mate: Runtime download failed",
				msg || t.settings.openclawInstallFailed,
				["mate", "connection", "local", "install", "failed"],
			);
			toast.error(t.settings.openclawInstallFailed);
		} finally {
			setOpenclawInstallLoading(false);
		}
	};

	const handleLocalRestart = async () => {
		setDirectActionLoading("local-restart");
		try {
			setDirectStatus({
				level: "info",
				message: t.settings.actionLocalRestarting,
			});
			addDirectActionLog(
				"info",
				"Mate: Local gateway restart requested",
				t.settings.actionLocalRestarting,
				["mate", "connection", "local", "restart"],
			);
			const daemonMessage = await invoke<string>("local_gateway_daemon", {
				action: "restart",
			});
			addDirectActionLog(
				"info",
				"Mate: Local gateway restart completed",
				daemonMessage || t.settings.actionLocalRestarted,
				["mate", "connection", "local", "service", "restart"],
			);
			await connectDiscoveredLocalGateway();
			setDirectMode("local");
			await invoke("save_app_config", {
				config: { connectionMode: "direct" },
			});
			setConnectionMode("direct");
			closeDirectModalSuccess(t.settings.actionLocalRestarted);
		} catch (e) {
			const msg = String(e);
			setDirectStatus({
				level: "error",
				message: msg,
			});
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
			setDirectStatus({
				level: "info",
				message: t.settings.actionCloudDisconnecting,
			});
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
			setDirectStatus({
				level: "error",
				message: msg,
			});
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
			setDirectStatus({
				level: "info",
				message: t.settings.actionCloudRestarting,
			});
			const currentAddr = directAddress.trim() || directCloudAddress.trim();
			if (!currentAddr) {
				setDirectStatus({
					level: "error",
					message: t.settings.cloudGatewayAddrRequired,
				});
				return;
			}
			const normalized = normalizeGatewayEndpoint(currentAddr);
			const token = directToken.trim() || runtimeConfig?.gatewayToken || "";
			const ok = await connectDirectGateway({
				gatewayUrl: normalized.gatewayUrl,
				gatewayWebUI: normalized.gatewayWebUI,
				gatewayToken: token,
				profileLabel: t.settings.directCloudGateway,
			});
			if (!ok) return;
			setDirectMode("cloud");
			setDirectCloudAddress(currentAddr);
			await invoke("save_app_config", {
				config: { connectionMode: "direct" },
			});
			setConnectionMode("direct");
			closeDirectModalSuccess(t.settings.actionCloudRestarted);
		} catch (e) {
			setDirectStatus({
				level: "error",
				message: String(e),
			});
		} finally {
			setDirectActionLoading(null);
		}
	};

	const inputClass =
		"w-full px-3 py-2 text-sm rounded-lg border border-white/15 bg-surface-variant text-surface-on placeholder:text-surface-on-variant/60 focus:outline-none focus:ring-1 focus:ring-white/20 font-mono tracking-wider";

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
						<ConnectionModeCard
							icon={Cable}
							title={t.settings.local}
							description={t.welcome.localDesc}
							hint={t.welcome.localHint}
							active={connectionMode === "direct" && isOnline}
							showPulse={connectionMode === "direct" && isOnline}
							onClick={handleDirectCardClick}
							meta={
								connectionMode === "direct" && isOnline && directMode ? (
									<p className="text-[11px] text-primary font-medium">
										{directMode === "local"
											? t.settings.directLocalGateway
											: t.settings.directCloudGateway}
									</p>
								) : null
							}
						/>
						<ConnectionModeCard
							icon={Server}
							title={t.settings.cloud}
							description={t.welcome.licenseDesc}
							hint={t.welcome.licenseHint}
							active={connectionMode === "tenant" && isOnline}
							showPulse={connectionMode === "tenant" && isOnline}
							onClick={handleLicenseCardClick}
							meta={
								connectionMode === "tenant" && isOnline && hasKey ? (
									<div className="space-y-1 mt-1.5">
										<div className="flex justify-between text-[11px] gap-2">
											<span className="text-surface-on-variant">
												{t.settings.keyLabel}
											</span>
											<span className="font-mono text-surface-on">
												{maskLicenseKey(licenseKey)}
											</span>
										</div>
										<div className="flex justify-between text-[11px] gap-2">
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
								) : null
							}
						/>
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
									<Select
										value={approvalRules[key]}
										onChange={(v) =>
											setApprovalRule(
												key,
												v as "always" | "never" | "sensitive_only",
											)
										}
										options={[
											{ value: "always", label: t.settings.always },
											{
												value: "sensitive_only",
												label: t.settings.sensitiveOnly,
											},
											{ value: "never", label: t.settings.never },
										]}
									/>
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
						{cachedLicenseProfile?.licenseKey && (
							<Button
								variant="outlined"
								onClick={handleRestoreTenantConnection}
								disabled={isLoading}
								className="w-full"
							>
								{t.sidebar.reconnect}
							</Button>
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
								onClick={() => {
									setDirectStatus(null);
									setDirectModalOpen(false);
								}}
								className="text-surface-on-variant hover:text-surface-on transition-colors"
							>
								<X size={15} />
							</button>
						</div>
						{directStatus && (
							<div
								className={`rounded-lg border px-3 py-2 text-xs ${
									directStatus.level === "error"
										? "border-red-500/40 bg-red-500/10 text-red-300"
										: "border-primary/40 bg-primary/10 text-primary"
								}`}
							>
								{directStatus.message}
							</div>
						)}
						{directStatus?.level === "error" &&
							isOpenclawNotInstalledError(directStatus.message) && (
								<div className="rounded-lg border border-primary/30 bg-primary/8 px-3 py-2.5 space-y-2">
									<p className="text-xs text-primary/90">
										{t.settings.openclawInstallHint}
									</p>
									{openclawInstallLoading && downloadProgress && (
										<div className="space-y-1">
											<div className="w-full bg-primary/20 rounded-full h-1.5 overflow-hidden">
												<div
													className="bg-primary h-1.5 rounded-full transition-all duration-200"
													style={{ width: `${downloadProgress.percent}%` }}
												/>
											</div>
											<p className="text-xs text-primary/70 text-right tabular-nums">
												{t.settings.openclawDownloadProgress
													.replace("{pct}", String(downloadProgress.percent))
													.replace(
														"{downloaded}",
														`${(downloadProgress.downloaded / 1024 / 1024).toFixed(1)}MB`,
													)
													.replace(
														"{total}",
														downloadProgress.total > 0
															? `${(downloadProgress.total / 1024 / 1024).toFixed(1)}MB`
															: "...",
													)}
											</p>
										</div>
									)}
									<Button
										size="sm"
										className="w-full"
										onClick={handleInstallOpenclaw}
										disabled={directBusy}
									>
										{openclawInstallLoading ? (
											<span className="flex items-center gap-2">
												<Loader2 size={12} className="animate-spin" />
												{t.settings.openclawInstalling}
											</span>
										) : (
											t.settings.openclawInstallAction
										)}
									</Button>
								</div>
							)}

						{directTarget === null && (
							<div className="space-y-3">
								<p className="text-xs text-surface-on-variant">
									{t.settings.directSelectHint}
								</p>
								{cachedLocalProfile && !directBusy && (
									<button
										type="button"
										onClick={handleRestoreDirectConnection}
										className="w-full text-xs rounded-lg border border-primary/40 bg-primary/10 text-primary px-3 py-2 hover:bg-primary/15 transition-colors"
									>
										{t.sidebar.reconnect}
									</button>
								)}
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
			{switchModeRequest && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
					<div className="bg-card-bg border border-card-border rounded-xl shadow-2xl ring-1 ring-white/10 w-full max-w-sm p-5 space-y-4">
						<div className="flex items-center gap-2">
							<TriangleAlert size={16} className="text-yellow-500 shrink-0" />
							<h3 className="text-sm font-semibold text-surface-on">
								{t.settings.switchModeTitle}
							</h3>
						</div>
						<p className="text-xs text-surface-on-variant leading-relaxed">
							{switchModeRequest.fromMode === "tenant"
								? t.settings.switchModeDescLicenseToLocal
								: t.settings.switchModeDescLocalToLicense}
						</p>
						<ul className="text-xs text-surface-on-variant space-y-1 pl-1">
							{[
								t.settings.switchModeResetItemToken,
								t.settings.switchModeResetItemSession,
								t.settings.switchModeResetItemApproval,
							].map((item) => (
								<li key={item} className="flex items-start gap-1.5">
									<span className="mt-0.5">•</span>
									<span>{item}</span>
								</li>
							))}
						</ul>
						<div className="flex gap-2 pt-1">
							<Button
								variant="outlined"
								className="flex-1"
								onClick={() => setSwitchModeRequest(null)}
								disabled={switchModeLoading}
							>
								{t.settings.cancel}
							</Button>
							<Button
								className="flex-1"
								onClick={handleSwitchModeConfirm}
								disabled={switchModeLoading}
							>
								{switchModeLoading ? (
									<Loader2 size={14} className="animate-spin" />
								) : (
									t.settings.switchModeConfirm
								)}
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ChannelAuthDialog } from "./components/features/channel-auth/ChannelAuthDialog";
import { WelcomeModal } from "./components/features/welcome/WelcomeModal";
import { ApiWizard } from "./components/features/wizard/ApiWizard";
import { FeishuWizard } from "./components/features/wizard/FeishuWizard";
import { AppLayout } from "./components/layout/AppLayout";
import { Toaster } from "./components/ui/sonner";
import { useNodeConnection } from "./hooks/useNodeConnection";
import { useTauriEvent } from "./hooks/useTauri";
import { useI18nStore, useT } from "./i18n";
import { ActivityPage } from "./pages/ActivityPage";
import { ChannelPage } from "./pages/ChannelPage";
import { ChatPage } from "./pages/ChatPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ModelsPage } from "./pages/ModelsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SkillsPage } from "./pages/SkillsPage";
import { useConfigStore, useConnectionStore, useTasksStore } from "./store";
import type { ConnectionMode } from "./store/config.store";

type GatewayEventEnvelope = {
	event: string;
	payload: unknown;
};
type StoredConnectionMode = ConnectionMode | "license" | "local";

interface LicenseProfileSnapshot {
	licenseKey?: string;
}

interface LocalProfileSnapshot {
	gatewayUrl?: string;
	gatewayWebUI?: string;
	gatewayToken?: string | null;
}

function normalizeConnectionMode(
	mode: StoredConnectionMode | null | undefined,
): ConnectionMode | null {
	if (!mode) return null;
	if (mode === "license") return "tenant";
	if (mode === "local") return "direct";
	return mode;
}

function normalizeGatewayEndpoint(value: string): {
	gatewayUrl: string;
	gatewayWebUI: string;
} {
	const raw = value.trim();
	if (!raw) {
		return { gatewayUrl: "", gatewayWebUI: "" };
	}
	if (/^wss?:\/\//i.test(raw)) {
		return {
			gatewayUrl: raw,
			gatewayWebUI: raw.replace(/^ws/i, "http"),
		};
	}
	if (/^https?:\/\//i.test(raw)) {
		return {
			gatewayUrl: raw.replace(/^http/i, "ws"),
			gatewayWebUI: raw,
		};
	}
	return {
		gatewayUrl: `wss://${raw}`,
		gatewayWebUI: `https://${raw}`,
	};
}

function isLoopbackEndpoint(endpoint: string): boolean {
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
}

function isGatewayTokenMismatchError(message: string): boolean {
	const normalized = message.toLowerCase();
	return (
		normalized.includes("auth_token_mismatch") ||
		normalized.includes("token_mismatch") ||
		normalized.includes("gateway token mismatch")
	);
}

function AppInner() {
	const t = useT();
	const theme = useI18nStore((s) => s.theme);
	const status = useConnectionStore((s) => s.status);
	const hydrateLogsFromFile = useTasksStore((s) => s.hydrateLogsFromFile);
	const {
		setConnectionMode,
		licenseKey,
		setLicenseKey,
		setDirectMode,
		setDirectCloudAddress,
		directMode,
		directCloudAddress,
		hasConnectedOnce,
		skipModelGuide,
		skipFeishuGuide,
		setSkipModelGuide,
		setSkipFeishuGuide,
	} = useConfigStore();
	const { verifyAndConnect, connectDirectGateway } = useNodeConnection();

	const [showChannelAuthDialog, setShowChannelAuthDialog] = useState(false);
	const [showWelcome, setShowWelcome] = useState(false);
	const [autoReconnectOpen, setAutoReconnectOpen] = useState(false);
	const [autoReconnectText, setAutoReconnectText] = useState("");
	const [showModelWizard, setShowModelWizard] = useState(false);
	const [showFeishuWizard, setShowFeishuWizard] = useState(false);

	const startupHandledRef = useRef(false);
	const guideTriggeredRef = useRef(false);

	const tryAutoReconnect = useCallback(
		async (mode: ConnectionMode): Promise<boolean> => {
			if (mode === "tenant") {
				setAutoReconnectText(t.welcome.autoReconnectTenant);
				const profile = await invoke<LicenseProfileSnapshot | null>(
					"get_license_profile",
				).catch(() => null);
				const key = profile?.licenseKey?.trim() || licenseKey.trim();
				if (!key) return false;
				setLicenseKey(key);
				return verifyAndConnect(key);
			}

			setAutoReconnectText(t.welcome.autoReconnectDirectLocal);
			const profile = await invoke<LocalProfileSnapshot | null>(
				"get_local_profile",
			).catch(() => null);

			const addReconnectLog = (
				level: "info" | "warning" | "error" | "success",
				title: string,
				description: string,
			) => {
				useTasksStore.getState().addClientLog({
					id: `mate-reconnect-${Date.now()}`,
					timestamp: new Date(),
					task_id: "",
					source: "mate",
					level,
					title,
					description,
					tags: ["mate", "reconnect", "local"],
				});
			};
			const maskToken = (tk: string) =>
				tk ? `${tk.slice(0, 4)}***${tk.slice(-4)}` : "(empty)";

			const reconnectLocalGateway = async (): Promise<boolean> => {
				const discovered = await invoke<{
					gateway_url: string;
					gateway_web_ui: string;
					token: string;
				}>("local_connect").catch(() => null);
				if (!discovered) return false;
				addReconnectLog(
					"info",
					"Reconnect: first local_connect",
					`url=${discovered.gateway_url} token=${maskToken(discovered.token)}`,
				);
				let ok = await connectDirectGateway({
					gatewayUrl: discovered.gateway_url,
					gatewayWebUI: discovered.gateway_web_ui,
					gatewayToken: discovered.token,
					profileLabel: t.settings.directLocalGateway,
				});
				if (!ok) {
					const currentError = useConnectionStore.getState().errorMessage || "";
					if (isGatewayTokenMismatchError(currentError)) {
						addReconnectLog(
							"warning",
							"Reconnect: token mismatch, restarting daemon",
							`token=${maskToken(discovered.token)} error=${currentError}`,
						);
						await invoke("local_gateway_daemon", {
							action: "restart",
						}).catch(() => null);
						const retryDiscovered = await invoke<{
							gateway_url: string;
							gateway_web_ui: string;
							token: string;
						}>("local_connect").catch(() => null);
						if (retryDiscovered) {
							addReconnectLog(
								"info",
								"Reconnect: second local_connect after restart",
								`token=${maskToken(retryDiscovered.token)} same=${discovered.token === retryDiscovered.token}`,
							);
							ok = await connectDirectGateway({
								gatewayUrl: retryDiscovered.gateway_url,
								gatewayWebUI: retryDiscovered.gateway_web_ui,
								gatewayToken: retryDiscovered.token,
								profileLabel: t.settings.directLocalGateway,
							});
						}
					}
				}
				if (ok) {
					setDirectMode("local");
					setDirectCloudAddress("");
				}
				return ok;
			};

			let endpoint = (
				profile?.gatewayUrl ||
				profile?.gatewayWebUI ||
				""
			).trim();
			if (!endpoint) {
				if (directMode === "local") {
					return reconnectLocalGateway();
				}
				if (directMode === "cloud" && directCloudAddress.trim()) {
					endpoint = directCloudAddress.trim();
				} else {
					return false;
				}
			}

			if (isLoopbackEndpoint(endpoint)) {
				return reconnectLocalGateway();
			}

			setAutoReconnectText(t.welcome.autoReconnectDirectCloud);
			const normalized = normalizeGatewayEndpoint(endpoint);
			const ok = await connectDirectGateway({
				gatewayUrl: normalized.gatewayUrl,
				gatewayWebUI: normalized.gatewayWebUI,
				gatewayToken: profile?.gatewayToken?.trim() ?? "",
				profileLabel: t.settings.directCloudGateway,
			});
			if (ok) {
				setDirectMode("cloud");
				setDirectCloudAddress(endpoint);
			}
			return ok;
		},
		[
			connectDirectGateway,
			directCloudAddress,
			directMode,
			licenseKey,
			setDirectCloudAddress,
			setDirectMode,
			setLicenseKey,
			t.settings.directCloudGateway,
			t.settings.directLocalGateway,
			t.welcome.autoReconnectDirectCloud,
			t.welcome.autoReconnectDirectLocal,
			t.welcome.autoReconnectTenant,
			verifyAndConnect,
		],
	);

	// 启动时加载 connectionMode，并按历史连接状态决定是否自动重连
	useEffect(() => {
		if (startupHandledRef.current) return;
		startupHandledRef.current = true;

		let cancelled = false;
		const bootstrap = async () => {
			try {
				const { connectionMode: rawMode } = await invoke<{
					connectionMode: StoredConnectionMode | null;
				}>("get_app_config");
				const normalized = normalizeConnectionMode(rawMode);
				setConnectionMode(normalized);

				if (!hasConnectedOnce) {
					if (!cancelled) setShowWelcome(true);
					return;
				}
				if (!normalized) return;

				if (!cancelled) {
					setAutoReconnectOpen(true);
					setAutoReconnectText(t.welcome.autoReconnectPreparing);
				}
				await tryAutoReconnect(normalized);
			} catch {
				if (!hasConnectedOnce && !cancelled) {
					setShowWelcome(true);
				}
			} finally {
				if (!cancelled) {
					setAutoReconnectOpen(false);
				}
			}
		};

		void bootstrap();
		return () => {
			cancelled = true;
		};
	}, [
		hasConnectedOnce,
		setConnectionMode,
		t.welcome.autoReconnectPreparing,
		tryAutoReconnect,
	]);

	// 启动时从当日日志文件回灌活动日志
	useEffect(() => {
		void hydrateLogsFromFile();
	}, [hydrateLogsFromFile]);

	// 将主题色同步到 html 元素
	useEffect(() => {
		const root = window.document.documentElement;

		const setHtmlClass = (isDark: boolean) => {
			root.classList.add(isDark ? "dark" : "light");
			root.classList.remove(isDark ? "light" : "dark");
			root.style.colorScheme = isDark ? "dark" : "light";
			getCurrentWindow()
				.setTheme(isDark ? "dark" : "light")
				.catch((e) => console.warn("[theme] setTheme failed:", e));
		};

		if (theme === "system") {
			const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
			setHtmlClass(mediaQuery.matches);

			const handler = (e: MediaQueryListEvent) => setHtmlClass(e.matches);
			mediaQuery.addEventListener("change", handler);
			return () => mediaQuery.removeEventListener("change", handler);
		}

		setHtmlClass(theme === "dark");
	}, [theme]);

	// 首次上线后的模型/飞书引导：点击“稍后设置”后永久不再自动弹出
	useEffect(() => {
		if (status !== "online" || guideTriggeredRef.current) return;
		guideTriggeredRef.current = true;
		if (!skipModelGuide) {
			setShowModelWizard(true);
			return;
		}
		if (!skipFeishuGuide) {
			setShowFeishuWizard(true);
		}
	}, [skipFeishuGuide, skipModelGuide, status]);

	useTauriEvent<GatewayEventEnvelope>(
		"ws:gateway_event",
		useCallback((envelope) => {
			if (envelope.event === "channel.auth.required") {
				setShowChannelAuthDialog(true);
			} else if (envelope.event === "channel.auth.resolved") {
				setShowChannelAuthDialog(false);
			}
		}, []),
	);

	return (
		<>
			{showWelcome && <WelcomeModal onDone={() => setShowWelcome(false)} />}
			{autoReconnectOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
					<div className="rounded-xl border border-card-border bg-card-bg px-5 py-4 shadow-2xl ring-1 ring-white/10 flex items-center gap-3 min-w-[320px]">
						<Loader2 size={16} className="animate-spin text-primary" />
						<div>
							<p className="text-sm font-medium text-surface-on">
								{t.welcome.autoReconnectTitle}
							</p>
							<p className="text-xs text-surface-on-variant mt-0.5">
								{autoReconnectText}
							</p>
						</div>
					</div>
				</div>
			)}
			<Routes>
				<Route path="/" element={<AppLayout />}>
					<Route index element={<DashboardPage />} />
					<Route path="chat" element={<ChatPage />} />
					<Route path="models" element={<ModelsPage />} />
					<Route path="skills" element={<SkillsPage />} />
					<Route path="activity" element={<ActivityPage />} />
					<Route path="channel" element={<ChannelPage />} />
					<Route path="settings" element={<SettingsPage />} />
				</Route>
			</Routes>
			{showModelWizard && (
				<ApiWizard
					onSuccess={() => {
						setSkipModelGuide(true);
						setShowModelWizard(false);
						if (!skipFeishuGuide) {
							setShowFeishuWizard(true);
						}
					}}
					onClose={() => {
						setSkipModelGuide(true);
						setShowModelWizard(false);
						if (!skipFeishuGuide) {
							setShowFeishuWizard(true);
						}
					}}
				/>
			)}
			{showFeishuWizard && (
				<FeishuWizard
					onSuccess={() => {
						setSkipFeishuGuide(true);
						setShowFeishuWizard(false);
					}}
					onClose={() => {
						setSkipFeishuGuide(true);
						setShowFeishuWizard(false);
					}}
				/>
			)}
			{showChannelAuthDialog && (
				<ChannelAuthDialog onClose={() => setShowChannelAuthDialog(false)} />
			)}
		</>
	);
}

export default function App() {
	return (
		<BrowserRouter>
			<AppInner />
			{createPortal(
				<Toaster position="top-center" richColors />,
				document.body,
			)}
		</BrowserRouter>
	);
}

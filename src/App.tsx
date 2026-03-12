import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ChannelAuthDialog } from "./components/features/channel-auth/ChannelAuthDialog";
import { WelcomeModal } from "./components/features/welcome/WelcomeModal";
import { AppLayout } from "./components/layout/AppLayout";
import { Toaster } from "./components/ui/sonner";
import { useTauriEvent } from "./hooks/useTauri";
import { useI18nStore } from "./i18n";
import { ActivityPage } from "./pages/ActivityPage";
import { ChannelPage } from "./pages/ChannelPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useConfigStore, useTasksStore } from "./store";
import type { ConnectionMode } from "./store/config.store";

type GatewayEventEnvelope = {
	event: string;
	payload: unknown;
};

function AppInner() {
	const { setConnectionMode } = useConfigStore();
	const hydrateLogsFromFile = useTasksStore((s) => s.hydrateLogsFromFile);
	const [showChannelAuthDialog, setShowChannelAuthDialog] = useState(false);
	const [showWelcome, setShowWelcome] = useState(false);
	const theme = useI18nStore((s) => s.theme);

	// 启动时从文件加载 connectionMode
	useEffect(() => {
		invoke<{ connectionMode: ConnectionMode | null }>("get_app_config")
			.then(({ connectionMode: mode }) => {
				setConnectionMode(mode ?? null);
				if (!mode) setShowWelcome(true);
			})
			.catch(() => setShowWelcome(true));
	}, []);

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
			// 同步 Tauri 原生窗口主题（影响 Mica 材质明暗）
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
		} else {
			setHtmlClass(theme === "dark");
		}
	}, [theme]);

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
			<Routes>
				<Route path="/" element={<AppLayout />}>
					<Route index element={<DashboardPage />} />
					<Route path="activity" element={<ActivityPage />} />
					<Route path="channel" element={<ChannelPage />} />
					<Route path="settings" element={<SettingsPage />} />
				</Route>
			</Routes>
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
			<Toaster position="top-center" richColors />
		</BrowserRouter>
	);
}

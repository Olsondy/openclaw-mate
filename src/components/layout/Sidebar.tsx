import { invoke } from "@tauri-apps/api/core";
import {
	ClipboardList,
	LayoutDashboard,
	Loader2,
	MessageSquare,
	PanelLeftClose,
	PanelLeftOpen,
	RefreshCw,
	Settings,
	Terminal,
} from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useNodeConnection } from "../../hooks/useNodeConnection";
import { useT } from "../../i18n";
import { useConfigStore, useConnectionStore } from "../../store";

export function Sidebar() {
	const { runtimeConfig } = useConfigStore();
	const { status } = useConnectionStore();
	const { reconnectCurrent } = useNodeConnection();
	const [collapsed, setCollapsed] = useState(false);
	const t = useT();

	const isLoading = status === "auth_checking" || status === "connecting";
	const isOnline = status === "online";

	const navItems = [
		{ to: "/", icon: LayoutDashboard, label: t.sidebar.dashboard },
		{ to: "/channel", icon: MessageSquare, label: t.sidebar.channel },
		{ to: "/activity", icon: ClipboardList, label: t.sidebar.activity },
	];

	const openConsole = async () => {
		if (!runtimeConfig?.gatewayWebUI) return;
		await invoke("open_cloud_console", { url: runtimeConfig.gatewayWebUI });
	};

	const STROKE_WIDTH = 1.8;

	return (
		<aside
			className={`h-screen flex flex-col flex-shrink-0 transition-all duration-300 ease-in-out ${
				collapsed ? "w-[52px]" : "w-[200px]"
			}`}
		>
			{/* 1. TOP: Control Header + Gateway Status */}
			<div
				className={`h-14 flex items-center mb-2 gap-2 ${collapsed ? "flex-col justify-center px-2 gap-1" : "px-4"}`}
			>
				<button
					onClick={() => setCollapsed(!collapsed)}
					className="p-2 rounded-lg text-surface-on-variant hover:bg-surface-variant/50 hover:text-surface-on transition-colors outline-none"
					title={collapsed ? t.sidebar.expand : t.sidebar.collapse}
				>
					{collapsed ? (
						<PanelLeftOpen size={20} strokeWidth={STROKE_WIDTH} />
					) : (
						<PanelLeftClose size={20} strokeWidth={STROKE_WIDTH} />
					)}
				</button>

				{/* 网关状态：呼吸灯 + 文字 + 重连 */}
				{!collapsed ? (
					<div className="flex flex-nowrap items-center gap-1.5 ml-auto overflow-hidden">
						<span
							className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border ${
								isOnline
									? "border-green-500/30 bg-green-500/10 text-green-500"
									: "border-surface-on-variant/20 bg-surface-variant text-surface-on-variant"
							}`}
						>
							<span className="relative flex h-1.5 w-1.5">
								{isOnline && (
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
								)}
								<span
									className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isOnline ? "bg-green-500" : "bg-surface-on-variant"}`}
								/>
							</span>
							<span className="whitespace-nowrap">
								{isLoading
									? t.sidebar.gatewayConnecting
									: isOnline
										? t.sidebar.gatewayConnected
										: t.sidebar.gatewayDisconnected}
							</span>
						</span>
						{!isOnline && (
							<button
								type="button"
								onClick={() => reconnectCurrent()}
								disabled={isLoading}
								className="p-1 rounded-md text-surface-on-variant hover:text-surface-on hover:bg-surface-variant/50 transition-colors disabled:opacity-40"
								title={t.sidebar.reconnect}
							>
								{isLoading ? (
									<Loader2 size={12} className="animate-spin" />
								) : (
									<RefreshCw size={12} />
								)}
							</button>
						)}
					</div>
				) : (
					/* 折叠态：可点击的小圆点（点击重连） */
					<button
						type="button"
						onClick={() => !isOnline && reconnectCurrent()}
						disabled={isLoading || isOnline}
						className={`relative flex h-2.5 w-2.5 ${!isOnline ? "cursor-pointer" : "cursor-default"}`}
						title={
							isLoading
								? t.sidebar.gatewayConnecting
								: isOnline
									? t.sidebar.gatewayConnected
									: t.sidebar.gatewayDisconnected
						}
					>
						{isOnline && (
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60" />
						)}
						{isLoading ? (
							<Loader2
								size={10}
								className="animate-spin text-surface-on-variant"
							/>
						) : (
							<span
								className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? "bg-green-500" : "bg-surface-on-variant hover:bg-surface-on"}`}
							/>
						)}
					</button>
				)}
			</div>

			{/* 2. MIDDLE: Navigation Items */}
			<nav className="flex-1 px-3 space-y-1 overflow-y-auto overflow-x-hidden pt-4 custom-scrollbar">
				{navItems.map(({ to, icon: Icon, label }) => (
					<NavLink
						key={to}
						to={to}
						end={to === "/"}
						title={collapsed ? label : undefined}
						className={({ isActive }) =>
							`group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
								isActive
									? "bg-nav-hover text-surface-on font-medium"
									: "text-surface-on-variant hover:bg-nav-hover hover:text-surface-on"
							} ${collapsed ? "justify-center" : ""}`
						}
					>
						<Icon
							size={18}
							strokeWidth={STROKE_WIDTH}
							className="shrink-0 transition-transform duration-200 group-hover:scale-110"
						/>
						{!collapsed && (
							<span className="text-[13px] whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
								{label}
							</span>
						)}
					</NavLink>
				))}
			</nav>

			{/* 3. BOTTOM: System Entries */}
			<div className="p-3 space-y-1">
				<button
					onClick={openConsole}
					title={collapsed ? t.sidebar.devConsole : undefined}
					className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-surface-on-variant hover:bg-nav-hover hover:text-surface-on transition-all duration-200 group ${
						collapsed ? "justify-center" : ""
					}`}
				>
					<Terminal
						size={18}
						strokeWidth={STROKE_WIDTH}
						className="shrink-0 group-hover:scale-110 transition-transform duration-200"
					/>
					{!collapsed && (
						<span className="text-[13px] whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
							{t.sidebar.devConsole}
						</span>
					)}
				</button>

				<NavLink
					to="/settings"
					title={collapsed ? t.sidebar.settings : undefined}
					className={({ isActive }) =>
						`group flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${
							isActive
								? "bg-nav-hover text-surface-on font-medium"
								: "text-surface-on-variant hover:bg-nav-hover hover:text-surface-on"
						} ${collapsed ? "justify-center" : ""}`
					}
				>
					<Settings
						size={18}
						strokeWidth={STROKE_WIDTH}
						className="shrink-0 group-hover:rotate-45 transition-transform duration-300"
					/>
					{!collapsed && (
						<span className="text-[13px] whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
							{t.sidebar.settings}
						</span>
					)}
				</NavLink>
			</div>
		</aside>
	);
}

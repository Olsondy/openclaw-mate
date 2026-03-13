import { Bot } from "lucide-react";
import { TopBar } from "../components/layout/TopBar";
import { useT } from "../i18n";
import { useOperatorStore } from "../store";

export function ChatPage() {
	const t = useT();
	const operatorStatus = useOperatorStore((s) => s.status);
	const isConnected = operatorStatus === "connected";

	return (
		<>
			<TopBar title={t.chat.title} subtitle={t.topbar.chatSub} />
			<div className="flex-1 overflow-hidden flex">
				{!isConnected ? (
					<NotConnectedPlaceholder
						icon={<Bot size={32} strokeWidth={1.5} />}
						title={t.chat.notConnected}
						hint={t.chat.notConnectedHint}
					/>
				) : (
					<ChatLayout />
				)}
			</div>
		</>
	);
}

function ChatLayout() {
	const t = useT();

	return (
		<div className="flex flex-1 overflow-hidden">
			{/* 会话列表侧边栏 */}
			<aside className="w-56 flex-shrink-0 border-r border-outline/10 flex flex-col p-3 gap-2">
				<p className="text-[11px] font-semibold text-surface-on-variant uppercase tracking-wider px-1">
					{t.chat.title}
				</p>
				<div className="flex-1 flex items-center justify-center">
					<p className="text-xs text-surface-on-variant/50">{t.chat.loading}</p>
				</div>
			</aside>

			{/* 消息区域 */}
			<main className="flex-1 flex flex-col items-center justify-center text-surface-on-variant/40">
				<Bot size={40} strokeWidth={1} />
				<p className="text-sm mt-3">{t.chat.noSessions}</p>
			</main>
		</div>
	);
}

function NotConnectedPlaceholder({
	icon,
	title,
	hint,
}: {
	icon: React.ReactNode;
	title: string;
	hint: string;
}) {
	return (
		<div className="flex-1 flex flex-col items-center justify-center gap-3 text-surface-on-variant/50">
			<div className="text-surface-on-variant/30">{icon}</div>
			<p className="text-sm font-medium text-surface-on-variant">{title}</p>
			<p className="text-xs text-center max-w-xs">{hint}</p>
		</div>
	);
}

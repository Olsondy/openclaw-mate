import { useState } from "react";
import { FeishuWizard } from "../components/features/wizard/FeishuWizard";
import { TelegramWizard } from "../components/features/wizard/TelegramWizard";
import { TopBar } from "../components/layout/TopBar";
import { useT } from "../i18n";
import { useConnectionStore } from "../store";

// ─── Channel 定义 ────────────────────────────────────────────────

type ChannelId =
	| "feishu"
	| "telegram"
	| "qq"
	| "dingtalk"
	| "discord"
	| "whatsapp";

interface ChannelDef {
	id: ChannelId;
	emoji: string;
	color: string; // Tailwind bg color for icon backdrop
	textColor: string; // Tailwind text color
	available: boolean; // has a real wizard
}

const CHANNELS: ChannelDef[] = [
	{
		id: "telegram",
		emoji: "✈️",
		color: "bg-sky-500/15",
		textColor: "text-sky-400",
		available: true,
	},
	{
		id: "discord",
		emoji: "🎮",
		color: "bg-violet-500/15",
		textColor: "text-violet-400",
		available: false,
	},
	{
		id: "whatsapp",
		emoji: "💬",
		color: "bg-emerald-500/15",
		textColor: "text-emerald-400",
		available: false,
	},
	{
		id: "feishu",
		emoji: "🪁",
		color: "bg-blue-500/15",
		textColor: "text-blue-400",
		available: true,
	},
	{
		id: "dingtalk",
		emoji: "🔔",
		color: "bg-orange-500/15",
		textColor: "text-orange-400",
		available: false,
	},
	{
		id: "qq",
		emoji: "🐧",
		color: "bg-indigo-500/15",
		textColor: "text-indigo-400",
		available: false,
	},
];

// ─── Page ────────────────────────────────────────────────────────

export function ChannelPage() {
	const { status } = useConnectionStore();
	const isOnline = status === "online";
	const [feishuWizardOpen, setFeishuWizardOpen] = useState(false);
	const [telegramWizardOpen, setTelegramWizardOpen] = useState(false);
	const t = useT();

	const channelLabels: Record<ChannelId, { name: string; desc: string }> = {
		feishu: { name: t.channel.feishu, desc: t.channel.feishuDesc },
		telegram: { name: t.channel.telegram, desc: t.channel.telegramDesc },
		qq: { name: t.channel.qq, desc: t.channel.qqDesc },
		dingtalk: { name: t.channel.dingtalk, desc: t.channel.dingtalkDesc },
		discord: { name: t.channel.discord, desc: t.channel.discordDesc },
		whatsapp: { name: t.channel.whatsapp, desc: t.channel.whatsappDesc },
	};

	const handleConfigure = (id: ChannelId) => {
		if (id === "feishu") setFeishuWizardOpen(true);
		if (id === "telegram") setTelegramWizardOpen(true);
	};

	return (
		<>
			<TopBar title={t.sidebar.channel} subtitle={t.topbar.channelSub} />
			<div className="flex-1 overflow-auto p-6">
				<div className="grid grid-cols-2 gap-3 max-w-xl">
					{CHANNELS.map((ch) => {
						const { name, desc } = channelLabels[ch.id];
						return (
							<ChannelCard
								key={ch.id}
								channel={ch}
								name={name}
								desc={desc}
								isOnline={isOnline}
								onConfigure={() => handleConfigure(ch.id)}
								configureLabel={t.channel.configure}
								comingSoonLabel={t.channel.comingSoon}
								offlineLabel={t.channel.activateFirst}
							/>
						);
					})}
				</div>
			</div>

			{feishuWizardOpen && (
				<FeishuWizard
					onSuccess={() => setFeishuWizardOpen(false)}
					onClose={() => setFeishuWizardOpen(false)}
				/>
			)}
			{telegramWizardOpen && (
				<TelegramWizard
					onSuccess={() => setTelegramWizardOpen(false)}
					onClose={() => setTelegramWizardOpen(false)}
				/>
			)}
		</>
	);
}

// ─── ChannelCard ─────────────────────────────────────────────────

function ChannelCard({
	channel,
	name,
	desc,
	isOnline,
	onConfigure,
	configureLabel,
	comingSoonLabel,
	offlineLabel,
}: {
	channel: ChannelDef;
	name: string;
	desc: string;
	isOnline: boolean;
	onConfigure: () => void;
	configureLabel: string;
	comingSoonLabel: string;
	offlineLabel: string;
}) {
	return (
		<div className="aspect-square rounded-2xl border border-outline/10 bg-surface hover:border-outline/20 transition-colors flex flex-col items-center justify-between p-5">
			{/* Icon */}
			<div
				className={`w-12 h-12 rounded-xl ${channel.color} flex items-center justify-center text-2xl`}
			>
				{channel.emoji}
			</div>

			{/* Name + Desc */}
			<div className="text-center space-y-1">
				<p className="text-sm font-semibold text-surface-on">{name}</p>
				<p className="text-[11px] text-surface-on-variant leading-tight">
					{desc}
				</p>
			</div>

			{/* Action */}
			<div className="w-full">
				{!channel.available ? (
					<div className="w-full text-center py-1.5 text-[11px] font-medium text-surface-on-variant/50 rounded-lg border border-outline/10 bg-surface-variant/20">
						{comingSoonLabel}
					</div>
				) : !isOnline ? (
					<div className="w-full text-center py-1.5 text-[11px] text-surface-on-variant/50 rounded-lg border border-outline/10">
						{offlineLabel}
					</div>
				) : (
					<button
						type="button"
						onClick={onConfigure}
						className={`w-full py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${channel.color} ${channel.textColor} border-transparent hover:opacity-80`}
					>
						{configureLabel}
					</button>
				)}
			</div>
		</div>
	);
}

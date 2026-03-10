import { AlertCircle, CheckCircle, Loader2, Monitor } from "lucide-react";
import { useEffect, useRef } from "react";
import {
	type LocalConnectPhase,
	useLocalConnection,
} from "../../../hooks/useLocalConnection";
import { useTauriEvent } from "../../../hooks/useTauri";
import { useT } from "../../../i18n";
import { useConnectionStore } from "../../../store";
import { Button } from "../../ui";

interface Props {
	onConnected?: () => void;
}

export function LocalConnectPanel({ onConnected }: Props) {
	const { connectLocal, phase, logs } = useLocalConnection();
	const { status, setStatus } = useConnectionStore();
	const logRef = useRef<HTMLDivElement>(null);
	const t = useT();

	const phaseLabel: Record<LocalConnectPhase, string> = {
		idle: t.localConnect.idle,
		scanning: t.localConnect.scanning,
		pairing: t.localConnect.pairing,
		restarting: t.localConnect.restarting,
		connecting: t.localConnect.connecting,
		done: t.localConnect.done,
		error: t.localConnect.error,
	};

	const isLoading =
		phase === "scanning" ||
		phase === "pairing" ||
		phase === "restarting" ||
		phase === "connecting";

	const isOnline = status === "online";
	const isError = phase === "error";

	// 日志自动滚到底
	useEffect(() => {
		if (logRef.current) {
			logRef.current.scrollTop = logRef.current.scrollHeight;
		}
	}, [logs]);

	// 监听 ws:connected 更新 phase
	useTauriEvent("ws:connected", () => {
		setStatus("online");
		onConnected?.();
	});

	return (
		<div className="space-y-3">
			<p className="text-xs text-surface-on-variant leading-relaxed">
				{t.localConnect.desc}
			</p>

			{isOnline && (
				<div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 text-green-700 text-sm">
					<CheckCircle size={14} />
					<span>{t.localConnect.connected}</span>
				</div>
			)}

			{isError && (
				<div className="flex items-start gap-2 p-2.5 rounded-lg bg-error-container text-error-on-container text-sm">
					<AlertCircle size={14} className="mt-0.5 shrink-0" />
					<span>{t.localConnect.errorMsg}</span>
				</div>
			)}

			{logs.length > 0 && (
				<div
					ref={logRef}
					className="rounded-lg bg-surface-variant/30 border border-outline/20 p-3 space-y-0.5 max-h-36 overflow-y-auto"
				>
					{logs.map((line, i) => (
						<p
							key={i}
							className="text-xs font-mono text-surface-on-variant whitespace-pre-wrap leading-relaxed"
						>
							{line}
						</p>
					))}
				</div>
			)}

			<Button
				onClick={connectLocal}
				disabled={isLoading || isOnline}
				variant={isError ? "outlined" : undefined}
				className="w-full"
			>
				{isLoading ? (
					<span className="flex items-center gap-2">
						<Loader2 size={14} className="animate-spin" />
						{phaseLabel[phase]}
					</span>
				) : isOnline ? (
					<span className="flex items-center gap-2">
						<CheckCircle size={14} />
						{t.localConnect.connectedBtn}
					</span>
				) : (
					<span className="flex items-center gap-2">
						<Monitor size={14} />
						{phaseLabel[phase]}
					</span>
				)}
			</Button>
		</div>
	);
}

import { invoke } from "@tauri-apps/api/core";
import { CheckCircle, Download, Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useT } from "../../../i18n";
import { useConfigStore } from "../../../store";
import type { ConnectionMode } from "../../../store/config.store";
import { Button } from "../../ui";

interface Props {
	fromMode: ConnectionMode;
	toMode: ConnectionMode;
	onConfirm: () => void;
	onCancel: () => void;
}

export function SwitchModeDialog({
	fromMode,
	toMode,
	onConfirm,
	onCancel,
}: Props) {
	const {
		licenseKey,
		licenseId,
		expiryDate,
		runtimeConfig,
		approvalRules,
		resetForModeSwitch,
	} = useConfigStore();
	const [exportPath, setExportPath] = useState<string | null>(null);
	const [exporting, setExporting] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const t = useT();

	const isLicenseToLocal = fromMode === "license" && toMode === "local";

	const handleExport = async () => {
		setExporting(true);
		try {
			const profile = {
				licenseKey,
				licenseId: licenseId ?? null,
				gatewayEndpoint: runtimeConfig?.gatewayUrl ?? "",
				gatewayWebUI: runtimeConfig?.gatewayWebUI ?? "",
				expiryDate,
				modelConfigSnapshot: null,
				approvalRules: approvalRules as unknown as Record<string, string>,
			};
			const path = await invoke<string>("export_config_snapshot", { profile });
			setExportPath(path);
		} catch (e) {
			console.error("[export]", e);
		} finally {
			setExporting(false);
		}
	};

	const handleConfirm = async () => {
		setConfirming(true);
		try {
			// 保存当前 profile 到文件（切回时可复用）
			if (fromMode === "license" && licenseKey) {
				await invoke("save_license_profile", {
					profile: {
						licenseKey,
						licenseId: licenseId ?? null,
						gatewayEndpoint: runtimeConfig?.gatewayUrl ?? "",
						gatewayWebUI: runtimeConfig?.gatewayWebUI ?? "",
						expiryDate,
						modelConfigSnapshot: null,
						approvalRules: approvalRules as unknown as Record<string, string>,
					},
				});
			} else if (fromMode === "local" && runtimeConfig) {
				await invoke("save_local_profile", {
					profile: {
						gatewayUrl: runtimeConfig.gatewayUrl,
						gatewayWebUI: runtimeConfig.gatewayWebUI,
						agentId: runtimeConfig.agentId,
						deviceName: runtimeConfig.deviceName,
						lastConnectedAt: new Date().toISOString(),
					},
				});
			}

			// 更新文件中的 connectionMode
			await invoke("save_app_config", { config: { connectionMode: toMode } });

			// 清除内存中的会话数据
			resetForModeSwitch();

			onConfirm();
		} finally {
			setConfirming(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
			<div className="bg-card-bg border border-card-border rounded-xl shadow-2xl ring-1 ring-white/10 w-full max-w-sm mx-4 p-5 space-y-4">
				{/* 标题 */}
				<div className="flex items-center gap-2">
					<TriangleAlert size={16} className="text-yellow-500 shrink-0" />
					<h3 className="text-sm font-semibold text-surface-on">
						{t.settings.switchModeTitle}
					</h3>
				</div>

				{/* 说明 */}
				<p className="text-xs text-surface-on-variant leading-relaxed">
					{isLicenseToLocal
						? t.settings.switchModeDescLicenseToLocal
						: t.settings.switchModeDescLocalToLicense}
				</p>

				{/* License → Local：导出区域 */}
				{isLicenseToLocal && (
					<div className="rounded-lg border border-white/8 bg-surface p-3 space-y-2">
						<p className="text-xs text-surface-on-variant">
							{t.settings.switchModeExportSummary}
						</p>
						{exportPath ? (
							<div className="flex items-center gap-2 text-xs text-green-500">
								<CheckCircle size={13} />
								<span className="break-all">{exportPath}</span>
							</div>
						) : (
							<button
								type="button"
								onClick={handleExport}
								disabled={exporting}
								className="flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
							>
								{exporting ? (
									<Loader2 size={12} className="animate-spin" />
								) : (
									<Download size={12} />
								)}
								{exporting
									? t.settings.switchModeExporting
									: t.settings.switchModeExportAction}
							</button>
						)}
					</div>
				)}

				{/* 清除项说明 */}
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

				{/* 操作按钮 */}
				<div className="flex gap-2 pt-1">
					<Button
						variant="outlined"
						className="flex-1"
						onClick={onCancel}
						disabled={confirming}
					>
						{t.settings.cancel}
					</Button>
					<Button
						className="flex-1"
						onClick={handleConfirm}
						disabled={confirming}
					>
						{confirming ? (
							<Loader2 size={14} className="animate-spin" />
						) : (
							t.settings.switchModeConfirm
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}

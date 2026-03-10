import { invoke } from "@tauri-apps/api/core";
import { CheckCircle, Download, Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
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
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
			<div className="bg-card-bg border border-card-border rounded-xl shadow-2xl ring-1 ring-white/10 w-full max-w-sm mx-4 p-5 space-y-4">
				{/* 标题 */}
				<div className="flex items-center gap-2">
					<TriangleAlert size={16} className="text-yellow-500 shrink-0" />
					<h3 className="text-sm font-semibold text-surface-on">
						切换连接方式
					</h3>
				</div>

				{/* 说明 */}
				<p className="text-xs text-surface-on-variant leading-relaxed">
					{isLicenseToLocal
						? "切换到本地模式后，当前云端连接将断开。云端的模型 API 配置和规则无法自动迁移，建议先导出配置快照留存。"
						: "切换到 License 模式后，当前本地连接将断开。本地配对信息已保存，下次切换回来无需重新配对。"}
				</p>

				{/* License → Local：导出区域 */}
				{isLicenseToLocal && (
					<div className="rounded-lg border border-white/8 bg-surface p-3 space-y-2">
						<p className="text-xs text-surface-on-variant">
							导出内容：License Key、到期日、审批规则、模型配置快照（不含 API
							Key）
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
								{exporting ? "导出中..." : "导出配置快照"}
							</button>
						)}
					</div>
				)}

				{/* 清除项说明 */}
				<ul className="text-xs text-surface-on-variant space-y-1 pl-1">
					{[
						"当前连接 Token / Gateway",
						"License Key（或本地配对会话）",
						"审批规则将重置为默认值",
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
						取消
					</Button>
					<Button
						className="flex-1"
						onClick={handleConfirm}
						disabled={confirming}
					>
						{confirming ? (
							<Loader2 size={14} className="animate-spin" />
						) : (
							"确认切换"
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}

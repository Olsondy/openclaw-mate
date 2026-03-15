import { Cpu, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useGatewayConfig } from "../../../hooks/useGatewayConfig";
import { Button, Card, Select } from "../../ui";

interface Props {
	onSuccess: () => void;
	onClose: () => void;
}

const PROVIDERS = [
	{
		id: "zai",
		label: "Zhipu AI",
		baseUrl: "https://open.bigmodel.cn/api/paas/v4",
		api: "openai-completions",
	},
	{
		id: "openai",
		label: "OpenAI",
		baseUrl: "https://api.openai.com/v1",
		api: "openai-completions",
	},
	{
		id: "anthropic",
		label: "Anthropic",
		baseUrl: "https://api.anthropic.com/v1",
		api: "anthropic-messages",
	},
	{
		id: "deepseek",
		label: "DeepSeek",
		baseUrl: "https://api.deepseek.com/v1",
		api: "openai-completions",
	},
];

export function ApiWizard({ onSuccess, onClose }: Props) {
	const { patchConfig } = useGatewayConfig();
	const [providerId, setProviderId] = useState("");
	const [modelId, setModelId] = useState("");
	const [modelName, setModelName] = useState("");
	const [apiKey, setApiKey] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const provider = useMemo(
		() => PROVIDERS.find((p) => p.id === providerId) ?? null,
		[providerId],
	);
	const canSubmit =
		!!provider && modelId.trim() && modelName.trim() && apiKey.trim();

	const handleSubmit = async () => {
		if (!provider || !canSubmit) return;
		setLoading(true);
		setError(null);
		try {
			const modelIdValue = modelId.trim();
			const modelNameValue = modelName.trim();
			const providerIdValue = provider.id;
			const ok = await patchConfig({
				auth: {
					profiles: {
						[`${providerIdValue}:default`]: {
							provider: providerIdValue,
							label: provider.label,
							mode: "api_key",
							apiKey: apiKey.trim(),
						},
					},
				},
				models: {
					mode: "merge",
					providers: {
						[providerIdValue]: {
							baseUrl: provider.baseUrl,
							api: provider.api,
							apiKey: apiKey.trim(),
							label: provider.label,
							models: [
								{
									id: modelIdValue,
									name: modelNameValue,
								},
							],
						},
					},
				},
				agents: {
					defaults: {
						model: {
							primary: `${providerIdValue}/${modelIdValue}`,
						},
					},
				},
			});
			if (!ok) {
				setError("提交失败，请检查网关连接和 operator 权限");
				return;
			}
			onSuccess();
		} catch (e) {
			setError(String(e));
		} finally {
			setLoading(false);
		}
	};

	const inputClass =
		"w-full px-3 py-2 text-sm rounded-lg border border-white/15 bg-surface-variant text-surface-on placeholder:text-surface-on-variant/60 focus:outline-none focus:ring-1 focus:ring-white/20";

	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<Card className="w-full max-w-md shadow-2xl ring-1 ring-white/10">
				<div className="flex items-center gap-2 mb-4">
					<Cpu size={16} className="text-primary" />
					<h2 className="text-sm font-semibold text-surface-on">
						模型 API 配置向导
					</h2>
				</div>
				<p className="text-xs text-surface-on-variant mb-4">
					该配置将通过 operator 权限直接写入网关配置。
				</p>

				<div className="space-y-3">
					<div>
						<label
							htmlFor="api-provider"
							className="text-xs text-surface-on-variant mb-1 block"
						>
							模型供应商
						</label>
						<Select
							value={providerId}
							onChange={setProviderId}
							placeholder="请选择供应商"
							options={PROVIDERS.map((item) => ({
								value: item.id,
								label: item.label,
							}))}
							className="w-full"
						/>
					</div>

					<div>
						<label
							htmlFor="api-model-id"
							className="text-xs text-surface-on-variant mb-1 block"
						>
							模型 ID
						</label>
						<input
							id="api-model-id"
							value={modelId}
							onChange={(e) => setModelId(e.target.value)}
							placeholder="例如: glm-4.7-flash"
							className={inputClass}
							autoComplete="off"
						/>
					</div>

					<div>
						<label
							htmlFor="api-model-name"
							className="text-xs text-surface-on-variant mb-1 block"
						>
							模型名称
						</label>
						<input
							id="api-model-name"
							value={modelName}
							onChange={(e) => setModelName(e.target.value)}
							placeholder="例如: GLM-4.7 Flash"
							className={inputClass}
							autoComplete="off"
						/>
					</div>

					<div>
						<label
							htmlFor="api-key"
							className="text-xs text-surface-on-variant mb-1 block"
						>
							API Key
						</label>
						<input
							id="api-key"
							type="password"
							value={apiKey}
							onChange={(e) => setApiKey(e.target.value)}
							placeholder="sk-..."
							className={inputClass}
							autoComplete="off"
						/>
					</div>

					<div className="text-[11px] text-surface-on-variant">
						<div>Base URL: {provider?.baseUrl ?? "-"}</div>
						<div>协议: {provider?.api ?? "-"}</div>
					</div>

					{error && (
						<p className="text-xs text-error-on-container bg-error-container p-2 rounded-lg">
							{error}
						</p>
					)}

					<div className="flex gap-2 pt-2">
						<Button
							variant="text"
							onClick={onClose}
							disabled={loading}
							className="flex-1"
						>
							取消
						</Button>
						<Button
							onClick={handleSubmit}
							disabled={!canSubmit || loading}
							className="flex-1"
						>
							{loading ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								"提交"
							)}
						</Button>
					</div>
				</div>
			</Card>
		</div>
	);
}

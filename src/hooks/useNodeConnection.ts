import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { toast } from "sonner";
import {
	useBootstrapStore,
	useConfigStore,
	useConnectionStore,
} from "../store";
import type { VerifyResponse } from "../types";
import { useTauriEvent } from "./useTauri";

const TENANT_API_BASE = import.meta.env.VITE_TENANT_API_BASE ?? "";
const VERIFY_ENDPOINT = `${TENANT_API_BASE}/api/verify`;

interface DeviceIdentity {
	device_id: string;
	public_key_raw: string;
}

export function useNodeConnection() {
	const { setStatus, setError } = useConnectionStore();
	const { licenseKey, setRuntimeConfig, setUserProfile, setSessionMeta } =
		useConfigStore();
	const { setNeeds } = useBootstrapStore();

	useTauriEvent(
		"ws:connected",
		useCallback(() => setStatus("online"), [setStatus]),
	);
	useTauriEvent(
		"ws:disconnected",
		useCallback(() => setStatus("idle"), [setStatus]),
	);
	useTauriEvent<string>(
		"ws:error",
		useCallback((msg) => setError(msg), [setError]),
	);

	const verifyAndConnect = useCallback(async () => {
		if (!licenseKey.trim()) {
			toast.warning("请先在设置中配置 License Key");
			return;
		}

		try {
			setStatus("auth_checking");
			const identity = await getDeviceIdentity();
			const deviceName = getDeviceName();

			let result: VerifyResponse;
			if (import.meta.env.DEV) {
				result = await mockVerify(licenseKey, identity.device_id, deviceName);
			} else {
				const resp = await fetch(VERIFY_ENDPOINT, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						licenseKey,
						hwid: identity.device_id,
						deviceName,
						publicKey: identity.public_key_raw,
					}),
				});
				result = await resp.json();
			}

			if (!result.success) {
				setStatus("unauthorized");
				setError("License Key 无效或已过期，请检查后重试");
				return;
			}

			const { nodeConfig, userProfile } = result.data;

			if (userProfile.licenseStatus !== "Valid") {
				setStatus("unauthorized");
				setError(
					`授权状态异常：${userProfile.licenseStatus}，到期日：${userProfile.expiryDate}`,
				);
				return;
			}

			setRuntimeConfig(nodeConfig);
			setUserProfile(userProfile);
			if (nodeConfig.licenseId) {
				setSessionMeta({
					licenseId: nodeConfig.licenseId,
				});
			}
			if (result.data.needsBootstrap) {
				setNeeds(result.data.needsBootstrap);
			}

			setStatus("connecting");
			await invoke("connect_gateway", {
				gatewayUrl: nodeConfig.gatewayUrl,
				token: nodeConfig.gatewayToken,
				agentId: nodeConfig.agentId,
				deviceName: nodeConfig.deviceName,
			});
		} catch (e) {
			setError(String(e));
			setStatus("error");
		}
	}, [
		licenseKey,
		setError,
		setNeeds,
		setRuntimeConfig,
		setSessionMeta,
		setStatus,
		setUserProfile,
	]);

	return { verifyAndConnect };
}

async function getDeviceIdentity(): Promise<DeviceIdentity> {
	if (import.meta.env.DEV) {
		return {
			device_id: "dev-device-id",
			public_key_raw: "dev-public-key",
		};
	}
	return invoke<DeviceIdentity>("get_device_identity");
}

function getDeviceName(): string {
	const host = globalThis.location?.hostname || "exec-node";
	const platform = globalThis.navigator?.platform || "unknown";
	return `${host}-${platform}`;
}

async function mockVerify(
	licenseKey: string,
	hwid: string,
	deviceName: string,
): Promise<VerifyResponse> {
	await new Promise((resolve) => setTimeout(resolve, 800));
	if (!licenseKey || licenseKey.length < 4) {
		return {
			success: false,
			data: { nodeConfig: {} as never, userProfile: {} as never },
		};
	}

	return {
		success: true,
		data: {
			nodeConfig: {
				gatewayUrl: "ws://your-cloud-api.com:18789",
				gatewayWebUI: "http://your-web-ui.com:18789",
				gatewayToken: `mock-token-${hwid.slice(0, 8)}`,
				agentId: hwid.slice(0, 16),
				deviceName,
			},
			userProfile: {
				licenseStatus: "Valid",
				expiryDate: "2027-01-01",
			},
			needsBootstrap: {
				feishu: false,
				modelAuth: false,
			},
		},
	};
}

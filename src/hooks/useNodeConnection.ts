import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { toast } from "sonner";
import { useT } from "../i18n";
import { makeLogId } from "../lib/activity-log";
import { useConfigStore, useConnectionStore, useTasksStore } from "../store";
import type { VerifyResponse } from "../types";
import { useTauriEvent } from "./useTauri";

const TENANT_API_BASE = import.meta.env.VITE_TENANT_API_BASE ?? "";
const VERIFY_ENDPOINT = `${TENANT_API_BASE}/api/verify`;

interface DeviceIdentity {
	device_id: string;
	public_key_raw: string;
	private_key_raw?: string;
}

interface DirectGatewayOptions {
	gatewayUrl: string;
	gatewayToken?: string;
	gatewayWebUI?: string;
	profileLabel?: string;
}

export function useNodeConnection() {
	const { setStatus, setError, clearError } = useConnectionStore();
	const addClientLog = useTasksStore((s) => s.addClientLog);
	const t = useT();
	const {
		licenseKey,
		connectionMode,
		runtimeConfig,
		setRuntimeConfig,
		setUserProfile,
		setSessionMeta,
	} = useConfigStore();

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

	const addConnectionLog = useCallback(
		(
			level: "success" | "error" | "warning" | "info" | "pending",
			title: string,
			description: string,
			tags: string[],
		) => {
			addClientLog({
				id: makeLogId("mate"),
				timestamp: new Date(),
				task_id: "",
				source: "mate",
				level,
				title,
				description,
				tags,
			});
		},
		[addClientLog],
	);

	const verifyAndConnect = useCallback(async () => {
		if (!licenseKey.trim()) {
			toast.warning(t.settings.licenseKeyRequired);
			addConnectionLog(
				"warning",
				"Mate: Tenant connect blocked",
				t.settings.licenseKeyRequired,
				["mate", "connection", "tenant", "blocked"],
			);
			return;
		}

		try {
			clearError();
			setStatus("auth_checking");
			const identity = await getDeviceIdentity();
			const deviceName = getDeviceName();
			addConnectionLog(
				"info",
				"Mate: Tenant verify started",
				`device=${deviceName}`,
				["mate", "connection", "tenant", "verify"],
			);

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
				setError(t.settings.licenseKeyInvalid);
				addConnectionLog(
					"error",
					"Mate: Tenant verify failed",
					t.settings.licenseKeyInvalid,
					["mate", "connection", "tenant", "verify", "failed"],
				);
				return;
			}

			const { nodeConfig, userProfile } = result.data;

			if (userProfile.licenseStatus !== "Valid") {
				setStatus("unauthorized");
				const errMsg = t.settings.authStatusException
					.replace("{status}", userProfile.licenseStatus || "-")
					.replace("{expiry}", userProfile.expiryDate || "-");
				setError(errMsg);
				addConnectionLog("error", "Mate: Tenant status invalid", errMsg, [
					"mate",
					"connection",
					"tenant",
					"unauthorized",
				]);
				return;
			}

			setRuntimeConfig(nodeConfig);
			setUserProfile(userProfile);
			if (nodeConfig.licenseId) {
				setSessionMeta({
					licenseId: nodeConfig.licenseId,
				});
			}

			setStatus("connecting");
			addConnectionLog(
				"info",
				"Mate: Connecting tenant gateway",
				nodeConfig.gatewayUrl,
				["mate", "connection", "tenant", "connecting"],
			);
			await invoke("connect_gateway", {
				gatewayUrl: nodeConfig.gatewayUrl,
				token: nodeConfig.gatewayToken,
				agentId: nodeConfig.agentId,
				deviceName: nodeConfig.deviceName,
				publicKeyRaw: identity.public_key_raw,
				privateKeyRaw: identity.private_key_raw ?? null,
			});
			addConnectionLog(
				"success",
				"Mate: Tenant gateway connected",
				nodeConfig.gatewayUrl,
				["mate", "connection", "tenant", "connected"],
			);
		} catch (e) {
			const msg = String(e);
			setError(msg);
			setStatus("error");
			addConnectionLog(
				"error",
				"Mate: Tenant connect failed",
				msg || "Unknown error",
				["mate", "connection", "tenant", "failed"],
			);
		}
	}, [
		addConnectionLog,
		clearError,
		licenseKey,
		setError,
		setRuntimeConfig,
		setSessionMeta,
		setStatus,
		setUserProfile,
		t.settings.authStatusException,
		t.settings.licenseKeyInvalid,
		t.settings.licenseKeyRequired,
	]);

	const connectDirectGateway = useCallback(
		async (opts: DirectGatewayOptions) => {
			const gatewayUrl = opts.gatewayUrl.trim();
			const gatewayToken = opts.gatewayToken?.trim() ?? "";
			if (!gatewayUrl) {
				setError(t.settings.cloudGatewayAddrRequired);
				addConnectionLog(
					"warning",
					"Mate: Direct connect blocked",
					t.settings.cloudGatewayAddrRequired,
					["mate", "connection", "direct", "blocked"],
				);
				return false;
			}

			try {
				clearError();
				setStatus("connecting");
				addConnectionLog("info", "Mate: Direct connect started", gatewayUrl, [
					"mate",
					"connection",
					"direct",
					"connecting",
				]);

				const identity = await getDeviceIdentity();
				const deviceName = getDeviceName();
				const gatewayWebUI = resolveGatewayWebUI(
					opts.gatewayWebUI?.trim() || gatewayUrl,
					gatewayToken,
				);

				setRuntimeConfig({
					gatewayUrl,
					gatewayWebUI,
					gatewayToken,
					agentId: identity.device_id,
					deviceName,
				});
				setUserProfile({
					licenseStatus: opts.profileLabel ?? t.settings.modeLocal,
					expiryDate: t.settings.directModeLabel,
				});

				await invoke("connect_gateway", {
					gatewayUrl,
					token: gatewayToken,
					agentId: identity.device_id,
					deviceName,
					publicKeyRaw: identity.public_key_raw,
					privateKeyRaw: identity.private_key_raw ?? null,
				});
				addConnectionLog(
					"success",
					"Mate: Direct gateway connected",
					gatewayUrl,
					["mate", "connection", "direct", "connected"],
				);
				return true;
			} catch (e) {
				const msg = String(e);
				setError(msg);
				setStatus("error");
				addConnectionLog(
					"error",
					"Mate: Direct connect failed",
					msg || "Unknown error",
					["mate", "connection", "direct", "failed"],
				);
				return false;
			}
		},
		[
			addConnectionLog,
			clearError,
			setError,
			setRuntimeConfig,
			setStatus,
			setUserProfile,
			t.settings.cloudGatewayAddrRequired,
			t.settings.directModeLabel,
			t.settings.modeLocal,
		],
	);

	const reconnectCurrent = useCallback(async () => {
		addConnectionLog(
			"info",
			"Mate: Reconnect requested",
			`mode=${connectionMode}`,
			["mate", "connection", "reconnect"],
		);
		if (connectionMode === "license") {
			await verifyAndConnect();
			return;
		}
		if (!runtimeConfig) {
			setError(t.settings.reconnectMissing);
			addConnectionLog(
				"warning",
				"Mate: Reconnect blocked",
				t.settings.reconnectMissing,
				["mate", "connection", "reconnect", "blocked"],
			);
			return;
		}
		await connectDirectGateway({
			gatewayUrl: runtimeConfig.gatewayUrl,
			gatewayToken: runtimeConfig.gatewayToken,
			gatewayWebUI: runtimeConfig.gatewayWebUI,
			profileLabel: t.settings.modeLocal,
		});
	}, [
		addConnectionLog,
		connectDirectGateway,
		connectionMode,
		runtimeConfig,
		setError,
		t.settings.modeLocal,
		t.settings.reconnectMissing,
		verifyAndConnect,
	]);

	return { verifyAndConnect, connectDirectGateway, reconnectCurrent };
}

async function getDeviceIdentity(): Promise<DeviceIdentity> {
	try {
		return await invoke<DeviceIdentity>("get_device_identity");
	} catch (error) {
		if (!import.meta.env.DEV) {
			throw error;
		}
		// DEV fallback: keep base64url format valid to avoid signature parser crash.
		return {
			device_id: "dev-device-id",
			public_key_raw: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
			private_key_raw: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		};
	}
}

function getDeviceName(): string {
	const host = globalThis.location?.hostname || "exec-node";
	const platform = globalThis.navigator?.platform || "unknown";
	return `${host}-${platform}`;
}

function resolveGatewayWebUI(endpoint: string, token: string): string {
	const raw = endpoint.trim();
	if (!raw) return "";

	const withScheme = /^https?:\/\//i.test(raw)
		? raw
		: /^wss?:\/\//i.test(raw)
			? raw.replace(/^ws/i, "http")
			: `https://${raw}`;

	try {
		const url = new URL(withScheme);
		if (!url.hash && token) {
			url.hash = `token=${token}`;
		}
		return url.toString();
	} catch {
		return withScheme;
	}
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

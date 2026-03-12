import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "../i18n";
import { useConfigStore, useConnectionStore, useTasksStore } from "../store";
import { useNodeConnection } from "./useNodeConnection";

const invokeMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("./useTauri", () => ({
	useTauriEvent: vi.fn(),
}));

describe("useNodeConnection persistence", () => {
	beforeEach(() => {
		localStorage.clear();
		invokeMock.mockReset();
		invokeMock.mockResolvedValue(undefined);
		useI18nStore.setState({ locale: "zh", theme: "system" });
		useConnectionStore.setState({
			status: "idle",
			errorMessage: null,
			onlineAt: null,
		});
		useConfigStore.setState({
			licenseKey: "",
			expiryDate: "",
			runtimeConfig: null,
			userProfile: null,
			capabilities: { browser: true, system: false, vision: true },
			approvalRules: {
				browser: "sensitive_only",
				system: "always",
				vision: "never",
			},
			licenseId: null,
			connectionMode: null,
			directMode: null,
			directCloudAddress: "",
			hasConnectedOnce: false,
			skipModelGuide: false,
			skipFeishuGuide: false,
		});
		useTasksStore.setState({ logs: [], clientLogs: [], pendingApprovals: [] });
	});

	it("persists local profile and mode after direct connect success", async () => {
		invokeMock.mockImplementation(async (cmd: string) => {
			if (cmd === "get_device_identity") {
				return {
					device_id: "dev-id",
					public_key_raw: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
					private_key_raw: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
				};
			}
			return undefined;
		});

		const { result } = renderHook(() => useNodeConnection());
		let ok = false;
		await act(async () => {
			ok = await result.current.connectDirectGateway({
				gatewayUrl: "ws://127.0.0.1:18789",
				gatewayWebUI: "http://127.0.0.1:18789/#token=test",
				gatewayToken: "test-token",
				profileLabel: "本地网关",
			});
		});

		expect(ok).toBe(true);
		expect(invokeMock).toHaveBeenCalledWith("save_app_config", {
			config: { connectionMode: "direct" },
		});
		const persistCall = invokeMock.mock.calls.find(
			(call) => call[0] === "save_local_profile",
		);
		expect(persistCall).toBeDefined();
		expect(persistCall?.[1]).toMatchObject({
			profile: {
				gatewayUrl: "ws://127.0.0.1:18789",
				gatewayWebUI: "http://127.0.0.1:18789/#token=test",
				gatewayToken: "test-token",
				agentId: "dev-id",
			},
		});
	});

	it("persists license profile and mode after tenant connect success", async () => {
		useConfigStore.setState({
			licenseKey: "LIC-XXXX-TEST",
		});
		invokeMock.mockImplementation(async (cmd: string) => {
			if (cmd === "get_device_identity") {
				return {
					device_id: "dev-id",
					public_key_raw: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
					private_key_raw: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
				};
			}
			if (cmd === "tenant_verify") {
				return {
					success: true,
					data: {
						nodeConfig: {
							gatewayUrl: "wss://gw.example.com",
							gatewayWebUI: "https://gw.example.com/#token=test",
							gatewayToken: "gw-token",
							agentId: "agent-1",
							deviceName: "device-1",
							licenseId: 123,
						},
						userProfile: {
							licenseStatus: "Valid",
							expiryDate: "2099-01-01",
						},
					},
				};
			}
			return undefined;
		});

		const { result } = renderHook(() => useNodeConnection());
		let ok = false;
		await act(async () => {
			ok = await result.current.verifyAndConnect("LIC-XXXX-TEST");
		});

		expect(ok).toBe(true);
		expect(invokeMock).toHaveBeenCalledWith("save_app_config", {
			config: { connectionMode: "tenant" },
		});
		const persistCall = invokeMock.mock.calls.find(
			(call) => call[0] === "save_license_profile",
		);
		expect(persistCall).toBeDefined();
		expect(persistCall?.[1]).toMatchObject({
			profile: {
				licenseKey: "LIC-XXXX-TEST",
				licenseId: 123,
				gatewayEndpoint: "wss://gw.example.com",
			},
		});
	});
});

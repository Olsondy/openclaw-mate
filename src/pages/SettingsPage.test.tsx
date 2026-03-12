import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "../i18n";
import { useConfigStore, useConnectionStore, useTasksStore } from "../store";
import { SettingsPage } from "./SettingsPage";

const invokeMock = vi.fn().mockResolvedValue(undefined);
const verifyAndConnectMock = vi.fn().mockResolvedValue(true);
const connectDirectGatewayMock = vi.fn().mockResolvedValue(true);
const reconnectCurrentMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../hooks/useNodeConnection", () => ({
	useNodeConnection: () => ({
		verifyAndConnect: verifyAndConnectMock,
		connectDirectGateway: connectDirectGatewayMock,
		reconnectCurrent: reconnectCurrentMock,
	}),
}));

describe("SettingsPage breathing indicators", () => {
	beforeEach(() => {
		localStorage.clear();
		invokeMock.mockReset();
		invokeMock.mockResolvedValue(undefined);
		verifyAndConnectMock.mockReset();
		verifyAndConnectMock.mockResolvedValue(true);
		connectDirectGatewayMock.mockReset();
		connectDirectGatewayMock.mockResolvedValue(true);
		reconnectCurrentMock.mockReset();
		reconnectCurrentMock.mockResolvedValue(undefined);
		useI18nStore.setState({ locale: "zh", theme: "system" });
		useConnectionStore.setState({
			status: "online",
			errorMessage: null,
			onlineAt: new Date(),
		});
		useConfigStore.setState({
			licenseKey: "TEST-XXXX-XXXX-KEY1",
			expiryDate: "Permanent",
			runtimeConfig: null,
			userProfile: null,
			capabilities: { browser: true, system: false, vision: true },
			approvalRules: {
				browser: "sensitive_only",
				system: "always",
				vision: "never",
			},
			licenseId: null,
			connectionMode: "direct",
			directMode: "local",
			directCloudAddress: "",
		});
		useTasksStore.setState({ logs: [], clientLogs: [], pendingApprovals: [] });
	});

	it("records client log and keeps daemon control in backend on local connect failure", async () => {
		useConnectionStore.setState({
			status: "idle",
			errorMessage: null,
			onlineAt: null,
		});
		useConfigStore.setState({
			connectionMode: null,
			directMode: null,
		});
		invokeMock.mockImplementation(async (cmd: string) => {
			if (cmd === "local_connect") {
				throw new Error("local gateway not found");
			}
			return undefined;
		});

		render(<SettingsPage />);
		const directLabel = screen.getByText("直连");
		fireEvent.click(directLabel.closest("button") as HTMLButtonElement);
		const localDesc = await waitFor(() =>
			screen.getByText("自动探测本机已安装的网关"),
		);
		fireEvent.click(localDesc.closest("button") as HTMLButtonElement);

		await waitFor(() => {
			expect(useTasksStore.getState().clientLogs.length).toBeGreaterThan(0);
		});
		const daemonCalls = invokeMock.mock.calls.filter(
			(call) => call[0] === "local_gateway_daemon",
		);
		expect(daemonCalls.length).toBe(0);
		const localConnectCalls = invokeMock.mock.calls.filter(
			(call) => call[0] === "local_connect",
		);
		expect(localConnectCalls.length).toBe(1);
	});

	it("restarts local gateway and retries when local token mismatches", async () => {
		useConnectionStore.setState({
			status: "idle",
			errorMessage:
				'握手失败: unauthorized: gateway token mismatch (code=INVALID_REQUEST, details={"code":"AUTH_TOKEN_MISMATCH"})',
			onlineAt: null,
		});
		useConfigStore.setState({
			connectionMode: null,
			directMode: null,
		});
		connectDirectGatewayMock
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);
		invokeMock.mockImplementation(async (cmd: string) => {
			if (cmd === "local_connect") {
				return {
					gateway_url: "ws://127.0.0.1:18789",
					gateway_web_ui: "http://127.0.0.1:18789/#token=test-token",
					token: "test-token",
				};
			}
			if (cmd === "local_gateway_daemon") {
				return "Gateway restarted";
			}
			return undefined;
		});

		render(<SettingsPage />);
		const directLabel = screen.getByText("直连");
		fireEvent.click(directLabel.closest("button") as HTMLButtonElement);
		const localDesc = await waitFor(() =>
			screen.getByText("自动探测本机已安装的网关"),
		);
		fireEvent.click(localDesc.closest("button") as HTMLButtonElement);

		await waitFor(() => {
			expect(connectDirectGatewayMock).toHaveBeenCalledTimes(2);
		});
		const restartCalls = invokeMock.mock.calls.filter(
			(call) =>
				call[0] === "local_gateway_daemon" && call[1]?.action === "restart",
		);
		expect(restartCalls.length).toBe(1);
		const localConnectCalls = invokeMock.mock.calls.filter(
			(call) => call[0] === "local_connect",
		);
		expect(localConnectCalls.length).toBe(2);
	});

	it("shows switch-mode dialog when switching from tenant to direct while online", async () => {
		useConnectionStore.setState({
			status: "online",
			errorMessage: null,
			onlineAt: new Date(),
		});
		useConfigStore.setState({
			connectionMode: "tenant",
			directMode: null,
			licenseKey: "TEST-XXXX-XXXX-KEY1",
			expiryDate: "Permanent",
		});
		invokeMock.mockResolvedValue(undefined);

		render(<SettingsPage />);
		const directLabel = screen.getByText("直连");
		fireEvent.click(directLabel.closest("button") as HTMLButtonElement);

		expect(screen.getByText("切换连接方式")).toBeInTheDocument();
		fireEvent.click(screen.getByText("确认切换"));

		await waitFor(() => {
			expect(invokeMock).toHaveBeenCalledWith("save_app_config", {
				config: { connectionMode: "direct" },
			});
		});
		expect(invokeMock).toHaveBeenCalledWith("disconnect_gateway");
		expect(invokeMock).toHaveBeenCalledWith("op_disconnect");
	});

	it("restores tenant connection from cached profile", async () => {
		useConnectionStore.setState({
			status: "idle",
			errorMessage: null,
			onlineAt: null,
		});
		useConfigStore.setState({
			connectionMode: "tenant",
			licenseKey: "",
			directMode: null,
		});
		invokeMock.mockImplementation(async (cmd: string) => {
			if (cmd === "get_license_profile") {
				return {
					licenseKey: "RESTORE-XXXX-XXXX-KEY1",
				};
			}
			if (cmd === "get_local_profile") {
				return null;
			}
			return undefined;
		});

		render(<SettingsPage />);
		const cloudLabel = screen.getByText("租户");
		fireEvent.click(cloudLabel.closest("button") as HTMLButtonElement);

		await waitFor(() => {
			expect(
				screen.getByDisplayValue("RESTORE-XXXX-XXXX-KEY1"),
			).toBeInTheDocument();
		});

		fireEvent.click(screen.getByRole("button", { name: "重连" }));
		await waitFor(() => {
			expect(verifyAndConnectMock).toHaveBeenCalledWith(
				"RESTORE-XXXX-XXXX-KEY1",
			);
		});
	});
});

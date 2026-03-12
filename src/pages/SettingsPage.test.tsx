import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "../i18n";
import { useConfigStore, useConnectionStore, useTasksStore } from "../store";
import { SettingsPage } from "./SettingsPage";

const invokeMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock("../hooks/useNodeConnection", () => ({
	useNodeConnection: () => ({
		verifyAndConnect: vi.fn().mockResolvedValue(undefined),
		connectDirectGateway: vi.fn().mockResolvedValue(true),
		reconnectCurrent: vi.fn().mockResolvedValue(undefined),
	}),
}));

describe("SettingsPage breathing indicators", () => {
	beforeEach(() => {
		localStorage.clear();
		invokeMock.mockReset();
		invokeMock.mockResolvedValue(undefined);
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
			connectionMode: "local",
			directMode: "local",
			directCloudAddress: "",
		});
		useTasksStore.setState({ logs: [], clientLogs: [], pendingApprovals: [] });
	});

	it("records client log when local pre-connect fails", async () => {
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
		const localDesc = screen.getByText("自动探测本机已安装的网关");
		fireEvent.click(localDesc.closest("button") as HTMLButtonElement);

		await waitFor(() => {
			expect(useTasksStore.getState().clientLogs.length).toBeGreaterThan(0);
		});
		expect(invokeMock).toHaveBeenCalledWith("local_gateway_daemon", {
			action: "start",
		});
		await waitFor(
			() => {
				const localConnectCalls = invokeMock.mock.calls.filter(
					(call) => call[0] === "local_connect",
				);
				expect(localConnectCalls.length).toBeGreaterThan(1);
			},
			{ timeout: 7500 },
		);
	});
});

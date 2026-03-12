import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "../i18n";
import { useConfigStore, useConnectionStore } from "../store";
import { SettingsPage } from "./SettingsPage";

vi.mock("@tauri-apps/api/core", () => ({
	invoke: vi.fn().mockResolvedValue(undefined),
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
	});

	it("shows breathing indicator on the current connection card", () => {
		render(<SettingsPage />);
		expect(screen.getByTestId("active-mode-pulse-local")).toBeInTheDocument();
		expect(
			screen.queryByTestId("active-mode-pulse-license"),
		).not.toBeInTheDocument();
	});

	it("shows breathing indicator beside direct modal title when connected", () => {
		render(<SettingsPage />);
		const directLabel = screen.getByText("直连");
		fireEvent.click(directLabel.closest("button") as HTMLButtonElement);
		expect(screen.getByTestId("direct-modal-title-pulse")).toBeInTheDocument();
	});
});

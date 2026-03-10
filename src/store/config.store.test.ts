import { act, renderHook } from "@testing-library/react";
import { useConfigStore } from "./config.store";

describe("useConfigStore", () => {
	beforeEach(() => {
		useConfigStore.setState({
			licenseKey: "",
			runtimeConfig: null,
			userProfile: null,
			capabilities: { browser: true, system: false, vision: true },
			approvalRules: {
				browser: "sensitive_only",
				system: "always",
				vision: "never",
			},
			licenseId: null,
		});
	});

	it("setLicenseKey updates license key", () => {
		const { result } = renderHook(() => useConfigStore());
		act(() => result.current.setLicenseKey("test-license-key"));
		expect(result.current.licenseKey).toBe("test-license-key");
	});

	it("toggleCapability flips the value", () => {
		const { result } = renderHook(() => useConfigStore());
		act(() => result.current.toggleCapability("system"));
		expect(result.current.capabilities.system).toBe(true);
		act(() => result.current.toggleCapability("system"));
		expect(result.current.capabilities.system).toBe(false);
	});
});

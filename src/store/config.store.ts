import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
	ApprovalRules,
	Capabilities,
	NodeRuntimeConfig,
	UserProfile,
} from "../types";

export type ConnectionMode = "license" | "local";
export type DirectMode = "local" | "cloud";

/** 持久化至本地的设置 */
interface PersistedSettings {
	licenseKey: string;
	expiryDate: string;
	directMode: DirectMode | null;
	directCloudAddress: string;
}

interface ConfigState {
	licenseKey: string;
	expiryDate: string;
	runtimeConfig: NodeRuntimeConfig | null;
	userProfile: UserProfile | null;
	capabilities: Capabilities;
	approvalRules: ApprovalRules;
	licenseId: number | null;

	/** 连接模式：null 表示首次启动未选择，从 ~/.clatemate/config.json 加载 */
	connectionMode: ConnectionMode | null;
	/** 直连子模式：本地网关 / 云端网关 */
	directMode: DirectMode | null;
	/** 云端直连地址（用于下次回显） */
	directCloudAddress: string;

	setLicenseKey: (key: string) => void;
	setRuntimeConfig: (config: NodeRuntimeConfig) => void;
	setUserProfile: (profile: UserProfile) => void;
	clearSession: () => void;
	toggleCapability: (key: keyof Capabilities) => void;
	setApprovalRule: (
		key: keyof ApprovalRules,
		mode: ApprovalRules[keyof ApprovalRules],
	) => void;
	setSessionMeta: (meta: { licenseId: number }) => void;
	setConnectionMode: (mode: ConnectionMode | null) => void;
	setDirectMode: (mode: DirectMode | null) => void;
	setDirectCloudAddress: (address: string) => void;
	/** 切换模式时清除会话数据，但不清除 connectionMode 本身 */
	resetForModeSwitch: () => void;
}

const defaultCapabilities: Capabilities = {
	browser: true,
	system: false,
	vision: true,
};

const defaultApprovalRules: ApprovalRules = {
	browser: "sensitive_only",
	system: "always",
	vision: "never",
};

export const useConfigStore = create<ConfigState>()(
	persist(
		(set) => ({
			licenseKey: "",
			expiryDate: "",
			runtimeConfig: null,
			userProfile: null,
			capabilities: defaultCapabilities,
			approvalRules: defaultApprovalRules,
			licenseId: null,
			connectionMode: null,
			directMode: null,
			directCloudAddress: "",

			setLicenseKey: (licenseKey) => set({ licenseKey }),

			setRuntimeConfig: (runtimeConfig) => set({ runtimeConfig }),

			setUserProfile: (userProfile) =>
				set({ userProfile, expiryDate: userProfile.expiryDate }),

			clearSession: () =>
				set({ runtimeConfig: null, userProfile: null, licenseId: null }),

			toggleCapability: (key) =>
				set((state) => ({
					capabilities: {
						...state.capabilities,
						[key]: !state.capabilities[key],
					},
				})),

			setApprovalRule: (key, mode) =>
				set((state) => ({
					approvalRules: { ...state.approvalRules, [key]: mode },
				})),

			setSessionMeta: ({ licenseId }) => set({ licenseId }),

			setConnectionMode: (connectionMode) => set({ connectionMode }),
			setDirectMode: (directMode) => set({ directMode }),
			setDirectCloudAddress: (directCloudAddress) =>
				set({ directCloudAddress }),

			resetForModeSwitch: () =>
				set({
					runtimeConfig: null,
					userProfile: null,
					licenseId: null,
					licenseKey: "",
					expiryDate: "",
					approvalRules: defaultApprovalRules,
				}),
		}),
		{
			name: "easy-openclaw-settings",
			partialize: (state): PersistedSettings => ({
				licenseKey: state.licenseKey,
				expiryDate: state.expiryDate,
				directMode: state.directMode,
				directCloudAddress: state.directCloudAddress,
			}),
		},
	),
);

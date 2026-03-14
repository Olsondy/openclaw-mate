import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
	ApprovalRules,
	Capabilities,
	NodeRuntimeConfig,
	UserProfile,
} from "../types";

export type ConnectionMode = "tenant" | "direct";
export type DirectMode = "local" | "cloud";

/** 持久化至本地的设置 */
interface PersistedSettings {
	licenseKey: string;
	expiryDate: string;
	directMode: DirectMode | null;
	directCloudAddress: string;
	hasConnectedOnce: boolean;
	skipModelGuide: boolean;
	skipFeishuGuide: boolean;
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
	/** 是否曾经成功连接过（用于启动引导判定） */
	hasConnectedOnce: boolean;
	/** 模型引导是否已跳过/完成 */
	skipModelGuide: boolean;
	/** 飞书引导是否已跳过/完成 */
	skipFeishuGuide: boolean;
	/**
	 * 引导弹窗资格标志（仅内存，不持久化）
	 * 仅在以下两种场景下设为 true：
	 *   1. 启动时自动重连流程
	 *   2. Welcome 选模式确认流程
	 * Settings 手动连接不设置此标志，从而不触发引导
	 */
	guideEligible: boolean;

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
	markConnectedOnce: () => void;
	setSkipModelGuide: (value: boolean) => void;
	setSkipFeishuGuide: (value: boolean) => void;
	setGuideEligible: (eligible: boolean) => void;
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
			hasConnectedOnce: false,
			skipModelGuide: false,
			skipFeishuGuide: false,
			guideEligible: false,
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
			markConnectedOnce: () => set({ hasConnectedOnce: true }),
			setSkipModelGuide: (skipModelGuide) => set({ skipModelGuide }),
			setSkipFeishuGuide: (skipFeishuGuide) => set({ skipFeishuGuide }),
			setGuideEligible: (guideEligible) => set({ guideEligible }),
			resetForModeSwitch: () =>
				set({
					runtimeConfig: null,
					userProfile: null,
					licenseId: null,
				}),
		}),
		{
			name: "easy-openclaw-settings",
			partialize: (state): PersistedSettings => ({
				licenseKey: state.licenseKey,
				expiryDate: state.expiryDate,
				directMode: state.directMode,
				directCloudAddress: state.directCloudAddress,
				hasConnectedOnce: state.hasConnectedOnce,
				skipModelGuide: state.skipModelGuide,
				skipFeishuGuide: state.skipFeishuGuide,
			}),
		},
	),
);

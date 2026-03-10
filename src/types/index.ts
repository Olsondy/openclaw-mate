export type TaskType = "browser" | "system" | "vision";
export type LogLevel = "success" | "error" | "warning" | "info" | "pending";
export type ApprovalMode = "always" | "never" | "sensitive_only";
export type NodeStatus =
	| "idle"
	| "auth_checking"
	| "authorized"
	| "connecting"
	| "online"
	| "unauthorized"
	| "error"
	| "paused";

export interface Task {
	task_id: string;
	type: TaskType;
	payload: Record<string, unknown>;
	require_approval: boolean;
	timeout_ms: number;
}

export interface ActivityLog {
	id: string;
	timestamp: Date;
	task_id: string;
	level: LogLevel;
	title: string;
	description: string;
	tags: string[];
	/** 任务类型：browser / system / vision */
	task_type?: TaskType;
	/** 执行耗时（毫秒） */
	duration_ms?: number;
}

export interface Capabilities {
	browser: boolean;
	system: boolean;
	vision: boolean;
}

export interface ApprovalRules {
	browser: ApprovalMode;
	system: ApprovalMode;
	vision: ApprovalMode;
}

/** verify 接口返回的向导需求，true 表示该步骤尚未完成 */
export interface BootstrapNeeds {
	feishu?: boolean;
	modelAuth?: boolean;
}

/** 内存中的节点运行时配置（从服务端 verify 接口获取，不持久化） */
export interface NodeRuntimeConfig {
	gatewayUrl: string;
	gatewayWebUI: string;
	gatewayToken: string;
	agentId: string;
	deviceName: string;

	licenseId?: number;
}

/** 用户授权信息（从服务端 verify 接口获取） */
export interface UserProfile {
	licenseStatus: string;
	expiryDate: string;
}

/** 服务端 verify 接口的返回结构 */
export interface VerifyResponse {
	success: boolean;
	data: {
		nodeConfig: NodeRuntimeConfig;
		userProfile: UserProfile;
		needsBootstrap?: BootstrapNeeds;
	};
}

export interface PendingApproval {
	task: Task;
	resolve: (approved: boolean) => void;
}

export interface TaskStats {
	total: number;
	success: number;
	error: number;
	pending: number;
}

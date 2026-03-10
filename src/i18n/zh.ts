// Dict 接口：所有字段统一为 string 类型，确保英文字典能自由赋值
export type Dict = {
	sidebar: {
		dashboard: string;
		activity: string;
		channel: string;
		capabilities: string;
		settings: string;
		devConsole: string;
		expand: string;
		collapse: string;
		gatewayLabel: string;
		gatewayConnecting: string;
		gatewayConnected: string;
		gatewayDisconnected: string;
		reconnect: string;
	};
	topbar: {
		dashboardSub: string;
		activitySub: string;
		channelSub: string;
		capabilitiesSub: string;
		settingsSub: string;
	};
	dashboard: {
		status: string;
		totalTasks: string;
		successTasks: string;
		efficiency: string;
		avgDuration: string;
		successRate: string;
		failed: string;
		onlineDuration: string;
		recentActivity: string;
		realtimeStream: string;
		noActivity: string;
		pendingApprovals: string;
		allow: string;
		deny: string;
		instruction: string;
		taskDistribution: string;
		noStats: string;
		nodeBriefing: string;
		reconnect: string;
		newVersion: string;
		available: string;
		updating: string;
		updateNow: string;
		statusOnline: string;
		statusConnecting: string;
		statusAuthChecking: string;
		statusAuthorized: string;
		statusError: string;
		statusUnauthorized: string;
		statusIdle: string;
		statusPaused: string;
		tasks: string;
		nodeActive: string;
		nodeIdle: string;
	};
	activity: {
		all: string;
		errors: string;
		successes: string;
		warnings: string;
		noLogs: string;
	};
	capabilities: {
		browser: string;
		browserDesc: string;
		system: string;
		systemDesc: string;
		vision: string;
		visionDesc: string;
	};
	channel: {
		feishu: string;
		feishuDesc: string;
		configureFeishu: string;
		telegram: string;
		telegramDesc: string;
		configureTelegram: string;
		activateFirst: string;
	};
	welcome: {
		title: string;
		subtitle: string;
		licenseTitle: string;
		licenseDesc: string;
		licenseHint: string;
		localTitle: string;
		localDesc: string;
		localHint: string;
		initializing: string;
		continue: string;
		skip: string;
	};
	localConnect: {
		idle: string;
		scanning: string;
		pairing: string;
		restarting: string;
		connecting: string;
		done: string;
		error: string;
		desc: string;
		connected: string;
		errorMsg: string;
		connectedBtn: string;
	};
	settings: {
		licenseActivation: string;
		currentKey: string;
		expiry: string;
		permanent: string;
		authStatus: string;
		activated: string;
		notConnected: string;
		newKey: string;
		changeKey: string;
		cancel: string;
		verifying: string;
		connecting: string;
		verifyAndActivate: string;
		nodeStatus: string;
		authStatusLabel: string;
		expiryDate: string;
		deviceName: string;
		cloudConsole: string;
		open: string;
		feishuConfig: string;
		feishuConfigDesc: string;
		configureFeishu: string;
		apiConfig: string;
		apiConfigDesc: string;
		openWizard: string;
		activateFirst: string;
		approvalRules: string;
		always: string;
		sensitiveOnly: string;
		never: string;
		confirmChangeKey: string;
		confirmChangeDesc: string;
		confirmBullet1: string;
		confirmBullet2: string;
		irreversible: string;
		confirmChange: string;
		appearance: string;
		language: string;
		themeColor: string;
		themeLight: string;
		themeDark: string;
		themeSystem: string;
		localOpenClaw: string;
		licenseKeyLabel: string;
		agentId: string;
		approvalBrowser: string;
		approvalSystem: string;
		approvalVision: string;
		sectionConnection: string;
		sectionNode: string;
		sectionPreferences: string;
		current: string;
		cloud: string;
		local: string;
		keyLabel: string;
		expiryLabel: string;
		expiryPermanent: string;
		licenseModalTitle: string;
		currentKeyLabel: string;
		expiryTimeLabel: string;
		changeAndActivate: string;
		localModalTitle: string;
		modeCloud: string;
		modeLocal: string;
	};
};

export const zh: Dict = {
	// Sidebar
	sidebar: {
		dashboard: "控制面板",
		activity: "最近动态",
		channel: "通道配置",
		capabilities: "节点能力",
		settings: "设置",
		devConsole: "开发者控制台",
		expand: "展开菜单",
		collapse: "收起菜单",
		gatewayLabel: "网关 ：",
		gatewayConnecting: "连接中...",
		gatewayConnected: "已连接",
		gatewayDisconnected: "未连接",
		reconnect: "重连",
	},

	// TopBar subtitles
	topbar: {
		dashboardSub: "数据看板与实时活动监控",
		activitySub: "跨模块实时任务执行日志",
		channelSub: "通道配置",
		capabilitiesSub: "启用或禁用执行模块",
		settingsSub: "激活与配置",
	},

	// Dashboard
	dashboard: {
		status: "当前状态",
		totalTasks: "总任务",
		successTasks: "成功记录",
		efficiency: "执行效率",
		avgDuration: "平均响应耗时",
		successRate: "成功率",
		failed: "失败",
		onlineDuration: "在线时长",
		recentActivity: "最近活动",
		realtimeStream: "实时流",
		noActivity: "暂无活动记录",
		pendingApprovals: "待审批操作",
		allow: "允许执行",
		deny: "拒绝",
		instruction: "指令",
		taskDistribution: "任务类型分布",
		noStats: "暂无统计数据",
		nodeBriefing: "节点信息",
		reconnect: "立即重连",
		newVersion: "发现新版本",
		available: "可用",
		updating: "安装中...",
		updateNow: "立即更新",
		statusOnline: "在线",
		statusConnecting: "连接中",
		statusAuthChecking: "验证中",
		statusAuthorized: "已授权",
		statusError: "错误",
		statusUnauthorized: "未授权",
		statusIdle: "空闲",
		statusPaused: "已暂停",
		tasks: "任务",
		nodeActive: "运行中",
		nodeIdle: "空闲",
	},

	// Activity
	activity: {
		all: "全部动态",
		errors: "错误",
		successes: "成功",
		warnings: "警告",
		noLogs: "暂无活动日志",
	},

	// Capabilities
	capabilities: {
		browser: "浏览器自动化",
		browserDesc:
			"使用 Playwright 控制 Chrome/Firefox 执行网页操作、表单填写、数据抓取",
		system: "系统操作",
		systemDesc:
			"文件管理、进程控制、执行系统命令。注意：此模块风险较高，建议设置审批规则",
		vision: "视觉/OCR",
		visionDesc: "屏幕截图、OCR 文字识别、图像分析能力",
	},

	// Channel
	channel: {
		feishu: "飞书",
		feishuDesc:
			"配置飞书 App ID 和 App Secret，启用飞书消息通道后即可通过飞书与 AI 交互。",
		configureFeishu: "配置飞书",
		telegram: "Telegram",
		telegramDesc:
			"配置 Telegram Bot Token，启用 Telegram 消息通道后即可通过 Telegram 与 AI 交互。",
		configureTelegram: "配置 Telegram",
		activateFirst: "当前网关暂未链接。",
	},

	// Welcome
	welcome: {
		title: "欢迎使用 ClawMate",
		subtitle: "请选择连接方式，后续可在设置中切换",
		licenseTitle: "License 激活",
		licenseDesc: "输入 License Key 连接到云端 OpenClaw 服务，适合订阅制用户。",
		licenseHint: "激活后由云端统一管理配置",
		localTitle: "连接本地实例",
		localDesc: "自动发现并连接本机已安装的 OpenClaw，适合私有部署用户。",
		localHint: "配置存储在本地，完全离线可用",
		initializing: "正在初始化...",
		continue: "继续",
		skip: "稍后设置",
	},

	// Local Connect
	localConnect: {
		idle: "连接本地 OpenClaw",
		scanning: "正在搜索服务...",
		pairing: "正在配对设备...",
		restarting: "正在重启服务...",
		connecting: "正在连接...",
		done: "已连接",
		error: "重试",
		desc: "自动搜索并连接本地安装的 OpenClaw 服务（需本机安装，不支持容器）。首次连接会写入设备授权并重启服务。",
		connected: "已连接到本地 OpenClaw",
		errorMsg: "连接失败，查看下方日志，或手动重启 openclaw 服务后重试",
		connectedBtn: "已连接",
	},

	// Settings
	settings: {
		licenseActivation: "License 激活",
		currentKey: "当前 Key",
		expiry: "到期时间",
		permanent: "永久有效",
		authStatus: "授权状态",
		activated: "● 已激活",
		notConnected: "○ 未连接",
		newKey: "新 License Key",
		changeKey: "更换 License Key",
		cancel: "取消",
		verifying: "验证中...",
		connecting: "连接中...",
		verifyAndActivate: "验证并激活",
		nodeStatus: "节点状态",
		authStatusLabel: "授权状态",
		expiryDate: "到期日期",
		deviceName: "设备名",
		cloudConsole: "Cloud 控制台",
		open: "打开",
		feishuConfig: "飞书配置",
		feishuConfigDesc: "配置飞书 App ID 和 App Secret，以启用飞书消息通道。",
		configureFeishu: "配置飞书",
		apiConfig: "模型配置",
		apiConfigDesc: "手动覆盖节点当前模型配置，不会写回租户服务数据库。",
		openWizard: "打开配置向导",
		activateFirst: "当前网关暂未链接",
		approvalRules: "审批规则",
		always: "总是询问",
		sensitiveOnly: "敏感操作询问",
		never: "不询问",
		// Change key confirm dialog
		confirmChangeKey: "更换 License Key",
		confirmChangeDesc: "即将切换到新的 License Key，此操作将会：",
		confirmBullet1: "当前已绑定设备会自动解绑",
		confirmBullet2: "重新授权后节点数据将清空",
		irreversible: "此操作不可撤销，请谨慎操作。",
		confirmChange: "确认更换",
		// Appearance
		appearance: "外观",
		language: "语言",
		themeColor: "主题",
		themeLight: "浅色",
		themeDark: "深色",
		themeSystem: "跟随系统",
		localOpenClaw: "本地 OpenClaw",
		licenseKeyLabel: "License Key",
		agentId: "Agent ID",
		approvalBrowser: "浏览器自动化",
		approvalSystem: "系统操作",
		approvalVision: "视觉/OCR",
		// Sections
		sectionConnection: "连接方式",
		sectionNode: "智能体",
		sectionPreferences: "偏好设置",
		current: "当前",
		cloud: "云端",
		local: "本地",
		keyLabel: "Key",
		expiryLabel: "到期",
		expiryPermanent: "永久",
		licenseModalTitle: "License 激活",
		currentKeyLabel: "当前 Key",
		expiryTimeLabel: "到期时间",
		changeAndActivate: "更换并激活",
		localModalTitle: "本地 OpenClaw",
		modeCloud: "License 云端",
		modeLocal: "本地 OpenClaw",
	},
};

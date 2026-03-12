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
		gatewayConnecting: string;
		gatewayConnected: string;
		gatewayDisconnected: string;
		gatewayLabel: string;
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
		openclawVersion: string;
		configuredModels: string;
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
		auditLogs: string;
		gatewayLogs: string;
		all: string;
		errors: string;
		successes: string;
		warnings: string;
		levelLabel: string;
		keywordLabel: string;
		keywordPlaceholder: string;
		clearFilters: string;
		clearLogsFile: string;
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
		logRestartHeader: string;
		logRestartFooter: string;
		logFoundService: string;
		logAuthConnecting: string;
		logConnectedSuccess: string;
		logErrorPrefix: string;
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
		localeZh: string;
		localeEn: string;
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
		capabilitiesTitle: string;
		capabilitiesDesc: string;
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
		licenseKeyPlaceholder: string;
		localModalTitle: string;
		directModalTitle: string;
		directSelectHint: string;
		directLocalGateway: string;
		directLocalDesc: string;
		directCloudGateway: string;
		directCloudDesc: string;
		backToSelect: string;
		cloudGatewayAddr: string;
		cloudGatewayAddrPlaceholder: string;
		cloudGatewayToken: string;
		cloudGatewayTokenPlaceholder: string;
		connectNow: string;
		localStop: string;
		localRestart: string;
		cloudDisconnect: string;
		cloudRestart: string;
		cloudGatewayAddrRequired: string;
		actionLocalStarting: string;
		actionLocalStopping: string;
		actionLocalStopped: string;
		actionLocalRestarting: string;
		actionLocalRestarted: string;
		actionCloudConnecting: string;
		actionCloudConnected: string;
		actionCloudDisconnecting: string;
		actionCloudDisconnected: string;
		actionCloudRestarting: string;
		actionCloudRestarted: string;
		licenseKeyRequired: string;
		licenseKeyInvalid: string;
		authStatusException: string;
		reconnectMissing: string;
		directModeLabel: string;
		switchModeTitle: string;
		switchModeDescLicenseToLocal: string;
		switchModeDescLocalToLicense: string;
		switchModeExportSummary: string;
		switchModeExporting: string;
		switchModeExportAction: string;
		switchModeResetItemToken: string;
		switchModeResetItemSession: string;
		switchModeResetItemApproval: string;
		switchModeConfirm: string;
		modeCloud: string;
		modeLocal: string;
	};
	activityLog: {
		title: string;
		clientTab: string;
		gatewayTab: string;
		auditTab: string;
		clientEmpty: string;
		gatewayEmpty: string;
		auditEmpty: string;
		clear: string;
	};
};

export const zh: Dict = {
	// Sidebar
	sidebar: {
		dashboard: "仪表盘",
		activity: "活动日志",
		channel: "消息渠道",
		capabilities: "节点能力",
		settings: "设置",
		devConsole: "开发者控制台",
		expand: "展开菜单",
		collapse: "收起菜单",
		gatewayConnecting: "连接中...",
		gatewayConnected: "已连接",
		gatewayDisconnected: "未连接",
		gatewayLabel: "网关",
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
		totalTasks: "事件总数",
		successTasks: "成功记录",
		openclawVersion: "版本",
		configuredModels: "已配置模型数",
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
		auditLogs: "审计日志",
		gatewayLogs: "Gateway 日志",
		all: "全部动态",
		errors: "错误",
		successes: "成功",
		warnings: "警告",
		levelLabel: "级别",
		keywordLabel: "关键词",
		keywordPlaceholder: "按标题、描述或标签筛选",
		clearFilters: "清空筛选",
		clearLogsFile: "清空日志文件",
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
		licenseTitle: "租户连接",
		licenseDesc: "输入租户 License Key，由租户服务返回网关连接参数。",
		licenseHint: "适合 SaaS 租户接入场景",
		localTitle: "直连网关",
		localDesc: "直接连接网关（本地自动探测，或手动输入网关地址）。",
		localHint: "适合私有部署与自托管场景",
		initializing: "正在初始化...",
		continue: "继续",
		skip: "稍后设置",
	},

	// Local Connect
	localConnect: {
		idle: "本地链接",
		scanning: "正在搜索服务...",
		pairing: "正在准备连接参数...",
		restarting: "等待服务就绪...",
		connecting: "正在连接...",
		done: "已连接",
		error: "重试",
		desc: "自动搜索并连接本地安装的 OpenClaw",
		connected: "已连接到本地 OpenClaw",
		errorMsg: "连接失败，查看下方日志，或手动重启 openclaw 服务后重试",
		connectedBtn: "已连接",
		logRestartHeader: "--- 重启日志 ---",
		logRestartFooter: "--- 结束 ---",
		logFoundService: "发现服务：{url}",
		logAuthConnecting: "设备授权完成，正在连接...",
		logConnectedSuccess: "连接成功",
		logErrorPrefix: "错误：{error}",
	},

	// Settings
	settings: {
		licenseActivation: "租户连接",
		currentKey: "当前 Key",
		expiry: "到期时间",
		permanent: "永久有效",
		authStatus: "授权状态",
		activated: "● 已激活",
		notConnected: "○ 未连接",
		newKey: "新租户 Key",
		changeKey: "更换租户 Key",
		cancel: "取消",
		verifying: "验证中...",
		connecting: "连接中...",
		verifyAndActivate: "验证并连接",
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
		approvalRules: "审批规则",
		always: "总是询问",
		sensitiveOnly: "敏感操作询问",
		never: "不询问",
		// Change key confirm dialog
		confirmChangeKey: "更换租户 Key",
		confirmChangeDesc: "即将切换到新的租户 Key，此操作将会：",
		confirmBullet1: "当前已绑定设备会自动解绑",
		confirmBullet2: "重新授权后节点数据将清空",
		irreversible: "此操作不可撤销，请谨慎操作。",
		confirmChange: "确认更换",
		// Appearance
		appearance: "外观",
		language: "语言",
		localeZh: "中文",
		localeEn: "English",
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
		capabilitiesTitle: "节点能力",
		capabilitiesDesc: "控制智能体可用能力，建议与审批规则配合使用。",
		// Sections
		sectionConnection: "连接方式",
		sectionNode: "智能体",
		sectionPreferences: "偏好设置",
		current: "当前",
		cloud: "租户",
		local: "直连",
		keyLabel: "Key",
		expiryLabel: "到期",
		expiryPermanent: "永久",
		licenseModalTitle: "租户连接",
		currentKeyLabel: "当前 Key",
		expiryTimeLabel: "到期时间",
		changeAndActivate: "更换并连接",
		licenseKeyPlaceholder: "XXXX-XXXX-XXXX-XXXX",
		localModalTitle: "本地",
		directModalTitle: "直连",
		directSelectHint: "请选择直连方式。",
		directLocalGateway: "本地",
		directLocalDesc: "自动探测本机已安装的网关",
		directCloudGateway: "地址",
		directCloudDesc: "手动输入网关地址直连（可本地/局域网/云端）",
		backToSelect: "返回选择",
		cloudGatewayAddr: "网关地址",
		cloudGatewayAddrPlaceholder:
			"ws://127.0.0.1:18789 或 wss://gateway.example.com:18789",
		cloudGatewayToken: "网关 Token（可选）",
		cloudGatewayTokenPlaceholder: "留空表示无鉴权或由代理鉴权",
		connectNow: "立即连接",
		localStop: "停止",
		localRestart: "重启",
		cloudDisconnect: "断开",
		cloudRestart: "重启",
		cloudGatewayAddrRequired: "请先输入网关地址",
		actionLocalStarting: "正在启动本地网关...",
		actionLocalStopping: "正在停止本地网关...",
		actionLocalStopped: "本地网关已停止",
		actionLocalRestarting: "正在重启本地网关...",
		actionLocalRestarted: "本地网关重启并连接成功",
		actionCloudConnecting: "正在连接网关地址...",
		actionCloudConnected: "网关连接成功",
		actionCloudDisconnecting: "正在断开网关连接...",
		actionCloudDisconnected: "网关已断开",
		actionCloudRestarting: "正在重连网关...",
		actionCloudRestarted: "网关重连成功",
		licenseKeyRequired: "请先在设置中配置 License Key",
		licenseKeyInvalid: "License Key 无效或已过期，请检查后重试",
		authStatusException: "授权状态异常：{status}，到期日：{expiry}",
		reconnectMissing: "未找到可重连的网关配置，请先完成直连",
		directModeLabel: "直连模式",
		switchModeTitle: "切换连接方式",
		switchModeDescLicenseToLocal:
			"切换到本地模式后，当前云端连接将断开。云端的模型 API 配置和规则无法自动迁移，建议先导出配置快照留存。",
		switchModeDescLocalToLicense:
			"切换到租户模式后，当前本地连接将断开。本地配对信息已保存，下次切换回来无需重新配对。",
		switchModeExportSummary:
			"导出内容：License Key、到期日、审批规则、模型配置快照（不含 API Key）",
		switchModeExporting: "导出中...",
		switchModeExportAction: "导出配置快照",
		switchModeResetItemToken: "当前连接 Token / Gateway",
		switchModeResetItemSession: "License Key（或本地配对会话）",
		switchModeResetItemApproval: "审批规则将重置为默认值",
		switchModeConfirm: "确认切换",
		modeCloud: "租户连接",
		modeLocal: "网关直连",
	},
	activityLog: {
		title: "活动日志",
		clientTab: "客户端日志",
		gatewayTab: "Gateway 日志",
		auditTab: "审计日志",
		clientEmpty: "暂无客户端日志",
		gatewayEmpty: "Gateway 日志功能开发中",
		auditEmpty: "暂无审计日志",
		clear: "清空",
	},
};

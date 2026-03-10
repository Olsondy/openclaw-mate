import type { Dict } from "./zh";

export const en: Dict = {
	// Sidebar
	sidebar: {
		dashboard: "Dashboard",
		activity: "Activity",
		channel: "Channel",
		capabilities: "Capabilities",
		settings: "Settings",
		devConsole: "Dev Console",
		expand: "Expand menu",
		collapse: "Collapse menu",
		gatewayLabel: "Gateway: ",
		gatewayConnecting: "Connecting...",
		gatewayConnected: "Connected",
		gatewayDisconnected: "Disconnected",
		reconnect: "Reconnect",
	},

	// TopBar subtitles
	topbar: {
		dashboardSub: "Data overview & real-time activity monitoring",
		activitySub: "Real-time task execution logs across all modules",
		channelSub: "Channel Configuration",
		capabilitiesSub: "Enable or disable execution modules",
		settingsSub: "Activation & Configuration",
	},

	// Dashboard
	dashboard: {
		status: "Status",
		totalTasks: "Total Tasks",
		successTasks: "Successes",
		efficiency: "Efficiency",
		avgDuration: "Avg response time",
		successRate: "Success rate",
		failed: "Failed",
		onlineDuration: "Uptime",
		recentActivity: "Recent Activity",
		realtimeStream: "Real-time Stream",
		noActivity: "No activity logs yet",
		pendingApprovals: "Pending Approvals",
		allow: "Allow",
		deny: "Deny",
		instruction: "Instruction",
		taskDistribution: "Task Distribution",
		noStats: "No statistics yet",
		nodeBriefing: "Node Briefing",
		reconnect: "Reconnect",
		newVersion: "New version",
		available: "available",
		updating: "Installing...",
		updateNow: "Update Now",
		statusOnline: "Online",
		statusConnecting: "Connecting",
		statusAuthChecking: "Verifying",
		statusAuthorized: "Authorized",
		statusError: "Error",
		statusUnauthorized: "Unauthorized",
		statusIdle: "Idle",
		statusPaused: "Paused",
		tasks: "tasks",
		nodeActive: "Active",
		nodeIdle: "Idle",
	},

	// Activity
	activity: {
		all: "All Activity",
		errors: "Errors",
		successes: "Successes",
		warnings: "Warnings",
		noLogs: "No activity logs yet",
	},

	// Capabilities
	capabilities: {
		browser: "Browser Automation",
		browserDesc:
			"Control Chrome/Firefox with Playwright to perform web actions, form filling, and data scraping",
		system: "System Operations",
		systemDesc:
			"File management, process control, and shell commands. High-risk module — set approval rules.",
		vision: "Vision / OCR",
		visionDesc: "Screenshot capture, OCR text recognition, and image analysis",
	},

	// Channel
	channel: {
		feishu: "Feishu (Lark)",
		feishuDesc:
			"Configure Feishu App ID and App Secret to enable the Feishu messaging channel.",
		configureFeishu: "Configure Feishu",
		telegram: "Telegram",
		telegramDesc:
			"Configure a Telegram Bot Token to enable the Telegram messaging channel.",
		configureTelegram: "Configure Telegram",
		activateFirst: "The current gateway is not yet connected.",
	},

	// Welcome
	welcome: {
		title: "Welcome to ClawMate",
		subtitle: "Choose a connection mode. You can switch later in Settings.",
		licenseTitle: "License Activation",
		licenseDesc:
			"Enter a License Key to connect to the cloud OpenClaw service. Ideal for subscription users.",
		licenseHint: "Configuration managed centrally by cloud after activation",
		localTitle: "Connect Local Instance",
		localDesc:
			"Auto-discover and connect to a locally installed OpenClaw. Ideal for self-hosted users.",
		localHint: "Config stored locally, fully offline capable",
		initializing: "Initializing...",
		continue: "Continue",
		skip: "Set up later",
	},

	// Local Connect
	localConnect: {
		idle: "Connect Local OpenClaw",
		scanning: "Scanning for services...",
		pairing: "Pairing device...",
		restarting: "Restarting service...",
		connecting: "Connecting...",
		done: "Connected",
		error: "Retry",
		desc: "Auto-discover and connect to a locally installed OpenClaw service (local install required, no container support). First connection writes device authorization and restarts the service.",
		connected: "Connected to local OpenClaw",
		errorMsg:
			"Connection failed. Check the logs below, or restart the openclaw service manually and retry.",
		connectedBtn: "Connected",
	},

	// Settings
	settings: {
		licenseActivation: "License Activation",
		currentKey: "Current Key",
		expiry: "Expiry",
		permanent: "Permanent",
		authStatus: "Auth Status",
		activated: "● Activated",
		notConnected: "○ Not Connected",
		newKey: "New License Key",
		changeKey: "Change License Key",
		cancel: "Cancel",
		verifying: "Verifying...",
		connecting: "Connecting...",
		verifyAndActivate: "Verify & Activate",
		nodeStatus: "Node Status",
		authStatusLabel: "Auth Status",
		expiryDate: "Expiry Date",
		deviceName: "Device Name",
		cloudConsole: "Cloud Console",
		open: "Open",
		feishuConfig: "Feishu Config",
		feishuConfigDesc:
			"Configure Feishu App ID and App Secret to enable the Feishu channel.",
		configureFeishu: "Configure Feishu",
		apiConfig: "Model Config",
		apiConfigDesc:
			"Override the node model settings locally. Changes will not be written back to the tenant database.",
		openWizard: "Open Config Wizard",
		activateFirst:
			"The current gateway is not connected and cannot be configured.",
		approvalRules: "Approval Rules",
		always: "Always Ask",
		sensitiveOnly: "Sensitive Only",
		never: "Never",
		// Change key confirm dialog
		confirmChangeKey: "Change License Key",
		confirmChangeDesc:
			"You are about to switch to a new License Key. This will:",
		confirmBullet1: "Unbind the current device automatically",
		confirmBullet2: "Clear node data upon re-authorization",
		irreversible: "This action cannot be undone. Proceed with caution.",
		confirmChange: "Confirm Change",
		// Appearance
		appearance: "Appearance",
		language: "Language",
		themeColor: "Theme",
		themeLight: "Light",
		themeDark: "Dark",
		themeSystem: "System",
		localOpenClaw: "Local OpenClaw",
		licenseKeyLabel: "License Key",
		agentId: "Agent ID",
		approvalBrowser: "Browser Automation",
		approvalSystem: "System Operations",
		approvalVision: "Vision / OCR",
		// Sections
		sectionConnection: "Connection",
		sectionNode: "Agent",
		sectionPreferences: "Preferences",
		current: "Current",
		cloud: "Cloud",
		local: "Local",
		keyLabel: "Key",
		expiryLabel: "Expiry",
		expiryPermanent: "Permanent",
		licenseModalTitle: "License Activation",
		currentKeyLabel: "Current Key",
		expiryTimeLabel: "Expiry",
		changeAndActivate: "Change & Activate",
		localModalTitle: "Local OpenClaw",
		modeCloud: "Cloud License",
		modeLocal: "Local OpenClaw",
	},
};

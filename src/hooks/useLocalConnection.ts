import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import { useConfigStore, useConnectionStore } from "../store";

interface LocalConnectResult {
	gateway_url: string;
	gateway_web_ui: string;
	token: string;
	agent_id: string;
	device_name: string;
	restart_log: string | null;
}

export type LocalConnectPhase =
	| "idle"
	| "scanning"
	| "pairing"
	| "restarting"
	| "connecting"
	| "done"
	| "error";

export function useLocalConnection() {
	const { setStatus, setError } = useConnectionStore();
	const { setRuntimeConfig, setUserProfile } = useConfigStore();

	const [phase, setPhase] = useState<LocalConnectPhase>("idle");
	const [logs, setLogs] = useState<string[]>([]);

	const appendLog = (msg: string) =>
		setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ${msg}`]);

	const connectLocal = useCallback(async () => {
		setPhase("scanning");
		setLogs([]);
		appendLog("正在搜索本地 openclaw 服务...");
		setStatus("auth_checking");
		setError("");

		try {
			setPhase("pairing");
			appendLog("正在配对设备...");

			const result = await invoke<LocalConnectResult>("local_connect");

			if (result.restart_log) {
				appendLog("--- 重启日志 ---");
				result.restart_log.split("\n").forEach((line) => appendLog(line));
				appendLog("--- end ---");
				setPhase("restarting");
			}

			appendLog(`发现服务：${result.gateway_url}`);
			appendLog("设备授权完成，正在连接...");
			setPhase("connecting");
			setStatus("connecting");

			setRuntimeConfig({
				gatewayUrl: result.gateway_url,
				gatewayWebUI: result.gateway_web_ui,
				gatewayToken: result.token,
				agentId: result.agent_id,
				deviceName: result.device_name,
			});

			setUserProfile({
				licenseStatus: "Local",
				expiryDate: "Local Mode",
			});

			await invoke("connect_gateway", {
				gatewayUrl: result.gateway_url,
				token: result.token,
				agentId: result.agent_id,
				deviceName: result.device_name,
			});

			setPhase("done");
			appendLog("连接成功");
		} catch (e) {
			const msg = String(e);
			setPhase("error");
			setStatus("error");
			setError(msg);
			appendLog(`错误: ${msg}`);
		}
	}, [setError, setRuntimeConfig, setStatus, setUserProfile]);

	return { connectLocal, phase, logs };
}

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import { useTauriEvent } from "./useTauri";

export function useUpdater() {
	const [newVersion, setNewVersion] = useState<string | null>(null);
	const [installing, setInstalling] = useState(false);

	useTauriEvent<string>("update:available", (version) => {
		setNewVersion(version);
	});

	const installUpdate = useCallback(async () => {
		setInstalling(true);
		try {
			await invoke("install_update");
		} catch (e) {
			console.error("[updater] 安装失败:", e);
			setInstalling(false);
		}
	}, []);

	return { newVersion, installing, installUpdate };
}

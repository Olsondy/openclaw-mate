import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

export function useTauriEvent<T>(event: string, handler: (payload: T) => void) {
	useEffect(() => {
		const unlisten = listen<T>(event, (e) => handler(e.payload));
		return () => {
			unlisten.then((fn) => fn());
		};
	}, [event, handler]);
}

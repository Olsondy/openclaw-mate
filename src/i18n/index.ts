import { create } from "zustand";
import { persist } from "zustand/middleware";
import { en } from "./en";
import type { Dict } from "./zh";
import { zh } from "./zh";

export type Locale = "zh" | "en";
export type Theme = "light" | "dark" | "system";

const dictionaries: Record<Locale, Dict> = { zh, en };

interface I18nState {
	locale: Locale;
	theme: Theme;
	setLocale: (locale: Locale) => void;
	setTheme: (theme: Theme) => void;
}

export const useI18nStore = create<I18nState>()(
	persist(
		(set) => ({
			locale: "zh",
			theme: "system",
			setLocale: (locale) => set({ locale }),
			setTheme: (theme) => set({ theme }),
		}),
		{ name: "easy-openclaw-i18n" },
	),
);

/**
 * useT — 返回当前语言字典，使用方式：
 *   const t = useT()
 *   t.sidebar.dashboard  // '控制面板' or 'Dashboard'
 */
export function useT(): Dict {
	const locale = useI18nStore((s) => s.locale);
	return dictionaries[locale];
}

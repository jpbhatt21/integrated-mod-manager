import { atom, createStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
export const store = createStore();
import TEXT from "@/textData.json";
import { DEFAULTS, VERSION } from "./consts";
import {
	Category,
	ChangeInfo,
	DownloadList,
	Games,
	InstalledItem,
	Language,
	ModCheckProgressData,
	Mod,
	ModDataObj,
	NoticeData,
	OnlineData,
	Preset,
	ProgressData,
	Settings,
	ToastData,
} from "./types";
import type { Update } from "@tauri-apps/plugin-updater";
interface UpdateInfo {
	version: string;
	status: "available" | "downloading" | "ready" | "error" | "installed" | "ignored";
	date: string;
	body: string;
	raw: Update | null;
}
const OPTIMIZED = atomWithStorage("imm-optimized", {} as Record<string, string>);
const DEV_HIDE_PREVIEWS = atomWithStorage("imm-dev-hide-previews", false);
const SCALE = atomWithStorage("imm-scale", 0);
const BLUR = atomWithStorage("imm-blur", 1);
const ANIMATIONS = atomWithStorage("imm-animations", true);
export type LocalNavigationMode = "classic" | "categories" | "vertical";
const LOCAL_NAVIGATION_MODE = atomWithStorage<LocalNavigationMode>("imm-local-navigation-mode", "classic");
const LOCAL_NAVIGATION_PAGE = atom<"categories" | "mods">("categories");
const LOCAL_CATEGORY_FAVORITES = atomWithStorage<string[]>("imm-local-category-favorites", []);
const BACKUP_INI = atomWithStorage("imm-backup-ini", false);
const INIT_DONE = atom(false);
const MAIN_FUNC_STATUS = atom<string>("");
const FIRST_LOAD = atom(false);
const GAME = atom<Games>("");
const LANG = atom<Language>("en");
const SAVED_LANG = atomWithStorage<Language | "">("imm-lang", "");
const LAST_UPDATED = atom(Date.now());
const SETTINGS = atom<Settings>(DEFAULTS.SETTINGS);
const SOURCE = atom<string>("");
const TARGET = atom<string>("");
const DATA = atom<ModDataObj>({});
const PRESETS = atom<Preset[]>([]);
const CATEGORIES = atom<Category[]>([]);
const TYPES = atom<Category[]>([]);
const XXMI_MODE = atom<0 | 1>(0);
const XXMI_DIR = atom<string>("");
const LEFT_SIDEBAR_OPEN = atom(true);
const RIGHT_SIDEBAR_OPEN = atom(true);
const RIGHT_SLIDEOVER_OPEN = atom(false);
const ONLINE = atom(false);
const DOWNLOAD_LIST = atom<DownloadList>(DEFAULTS.DOWNLOAD_LIST);
const CURRENT_PRESET = atom(DEFAULTS.CURRENT_PRESET);
const MOD_LIST = atom<Mod[]>(DEFAULTS.MOD_LIST);
const SELECTED = atom(DEFAULTS.SELECTED);
const FILTER = atom(DEFAULTS.FILTER);
const SORT = atom(DEFAULTS.SORT);
const CATEGORY = atom(DEFAULTS.CATEGORY);
const SEARCH = atom(DEFAULTS.SEARCH);
const INSTALLED_ITEMS = atom<InstalledItem[]>(DEFAULTS.INSTALLED_ITEMS);
const ONLINE_DATA = atom<OnlineData>(DEFAULTS.ONLINE_DATA);
const ONLINE_TYPE = atom(DEFAULTS.ONLINE_TYPE);
const ONLINE_SORT = atom(DEFAULTS.ONLINE_SORT);
const ONLINE_PATH = atom(DEFAULTS.ONLINE_PATH);
const ONLINE_SELECTED = atom(DEFAULTS.ONLINE_SELECTED);
const TOASTS = atom<ToastData[]>([]);
const CHANGES = atom<ChangeInfo>({
	before: [],
	after: [],
	map: {},
	skip: false,
	title: "",
});
const TEXT_DATA = atom(TEXT["en"]);
const PROGRESS_OVERLAY = atom<ProgressData>({ title: "", open: false, finished: false, button: "", name: "" });
const MOD_CHECK_PROGRESS = atom<ModCheckProgressData>({ open: false, checked: 0, total: 0 });
const IMM_UPDATE = atom(null as UpdateInfo | null);
const UPDATER_OPEN = atom(false);
const NOTICE = atom<NoticeData>({
	heading: "",
	subheading: "",
	ignoreable: 2,
	timer: 10,
	ver: VERSION,
	id: 0,
});
const HELP_OPEN = atom(false);
const TUTORIAL_OPEN = atom(false);
const NOTICE_OPEN = atom(false);
const REMOVE_OPEN = atom(false);
const CONFLICTS_OPEN = atom(false);
const CONFLICTS = atom({
	conflicts: [] as string[][],
	mods: {} as Record<string, number>,
});
const CONFLICT_INDEX = atom(0);
export function openConflict(index = -1) {
	store.set(CONFLICTS_OPEN, (prev) => {
		if (!prev && index >= 0) {
			store.set(CONFLICT_INDEX, index);
		}
		return true;
	});
}
const FILE_TO_DL = atom("");
export function resetAtoms() {
	const atoms = {
		INIT_DONE,
		LANG,
		GAME,
		SETTINGS,
		SOURCE,
		TARGET,
		DATA,
		PRESETS,
		CATEGORIES,
		TYPES,
		CHANGES,
		ONLINE,
		DOWNLOAD_LIST,
		CURRENT_PRESET,
		MOD_LIST,
		SELECTED,
		FILTER,
		CATEGORY,
		SEARCH,
		SORT,
		INSTALLED_ITEMS,
		ONLINE_DATA,
		ONLINE_TYPE,
		ONLINE_PATH,
		ONLINE_SORT,
		ONLINE_SELECTED,
		XXMI_MODE,
	};
	store.set(FILE_TO_DL, "");
	Object.keys(atoms).forEach((atom) =>
		store.set(atoms[atom as keyof typeof atoms] as any, DEFAULTS[atom as keyof typeof DEFAULTS])
	);
}
const ERR = atom("");
const DATA_PATH = atom(null as string | null);
export {
	OPTIMIZED,
	DEV_HIDE_PREVIEWS,
	CONFLICTS,
	FILE_TO_DL,
	ERR,
	DATA_PATH,
	XXMI_DIR,
	XXMI_MODE,
	FIRST_LOAD,
	HELP_OPEN,
	TUTORIAL_OPEN,
	NOTICE,
	NOTICE_OPEN,
	REMOVE_OPEN,
	UPDATER_OPEN,
	CONFLICTS_OPEN,
	CONFLICT_INDEX,
	IMM_UPDATE,
	PROGRESS_OVERLAY,
	MOD_CHECK_PROGRESS,
	TOASTS,
	CURRENT_PRESET,
	INSTALLED_ITEMS,
	RIGHT_SLIDEOVER_OPEN,
	DOWNLOAD_LIST,
	TYPES,
	ONLINE_DATA,
	ONLINE_TYPE,
	ONLINE_PATH,
	ONLINE_SORT,
	ONLINE_SELECTED,
	CATEGORY,
	SEARCH,
	FILTER,
	GAME,
	INIT_DONE,
	MAIN_FUNC_STATUS,
	LANG,
	SAVED_LANG,
	SETTINGS,
	TEXT_DATA,
	SOURCE,
	TARGET,
	DATA,
	PRESETS,
	CATEGORIES,
	CHANGES,
	MOD_LIST,
	ONLINE,
	LEFT_SIDEBAR_OPEN,
	RIGHT_SIDEBAR_OPEN,
	LAST_UPDATED,
	SELECTED,
	SORT,
	SCALE,
	BLUR,
	ANIMATIONS,
	LOCAL_NAVIGATION_MODE,
	LOCAL_NAVIGATION_PAGE,
	LOCAL_CATEGORY_FAVORITES,
	BACKUP_INI,
};

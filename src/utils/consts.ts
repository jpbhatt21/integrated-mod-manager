import TEXT from "@/textData.json";
import {
	Category,
	ChangeInfo,
	DownloadItem,
	Games,
	InstalledItem,
	Language,
	Mod,
	ModDataObj,
	OnlineData,
	Preset,
	Settings,
} from "./types";
import { info } from "@/lib/logger";
export const OPTIMIZE_TARGET = "3.1.1";
export const IMAGE_SERVER = "http://127.0.0.1:3469/preview";
export const OLD_RESTORE = "DISABLED_RESTORE";
export const DISCORD_LINK = "https://discord.gg/QGkKzNapXZ";
export const BANANA_LINK = "https://gamebanana.com/mods/593490";
export const RESTORE = "RESTORE";
export const IGNORE = "IGNORE";
export const PREFS = ".USER_PREFS";
export const UNCATEGORIZED = "Uncategorized";
export const OLD_managedSRC = "DISABLED (Managed by IMM)";
export const OLD_managedTGT = "Mods (Managed by IMM)";
export const managedSRC = "DISABLED - ALL MODS ARE STORED HERE (Managed by IMM)";
export const managedTGT = "DO NOT MODIFY (Managed by IMM)";
export const INI_BACKUP = "DISABLED_IMM_INI_BACKUP"; //If changed, also update in src-tauri/src/lib.rs
export const VERSION = "4.0.0";
export const GAMES: Games[] = ["WW", "ZZ", "GI", "SR", "EF"];
export const GAME_GB_IDS: { [key: number]: Games } = {
	20357: "WW",
	19567: "ZZ",
	8552: "GI",
	18366: "SR",
	21842: "EF",
	0: "",
};
export const GAME_NAMES: { [key in Games]: string } = {
	WW: "WuWa",
	ZZ: "Z·Z·Z",
	"": "Integrated",
	GI: "Genshin",
	SR: "Star Rail",
	EF: "Endfield",
};
export const exts = ["png", "jpg", "jpeg", "webp", "gif"];
export const PRIORITY_KEYS = ["Alt", "Ctrl", "Shift", "Win", "Capslock", "Tab", "Up", "Down", "Left", "Right"] as const;
export const LANG_LIST: { Name: string; Flag: string; Code: Language }[] = [
	{
		Name: TEXT.en.Current,
		Flag: TEXT.en.Flag,
		Code: "en",
	},
	{
		Name: TEXT.cn.Current,
		Flag: TEXT.cn.Flag,
		Code: "cn",
	},
	{
		Name: TEXT.ru.Current,
		Flag: TEXT.ru.Flag,
		Code: "ru",
	},
	{
		Name: TEXT.jp.Current,
		Flag: TEXT.jp.Flag,
		Code: "jp",
	},
	{
		Name: TEXT.kr.Current,
		Flag: TEXT.kr.Flag,
		Code: "kr",
	},
];
export const ONLINE_TRANSITION = (online: boolean, move = false) => ({
	initial: { opacity: 0, x: move ? (online ? "25%" : "-25%") : 0 },
	animate: { opacity: 1, x: 0 },
	exit: { opacity: 0, x: move ? (online ? "25%" : "-25%") : 0 },
	transition: { duration: 0.2 },
});
export const GAME_ID_MAP: { [key: string]: number } = {
	WW: 0,
	ZZ: 1,
	GI: 2,
	SR: 3,
	EF: 4,
};
export const DEFAULTS = {
	INIT_DONE: false,
	LANG: "en" as Language,
	GAME: "" as Games,
	SETTINGS: {
		global: {
			clientDate: "",
			version: VERSION,
			lang: "",
			XXMI: "",
			preReleases: false,
			chkModUpdates: true,
			ignore: "2.1.0",
			game: "",
			updatedAt: "",
			notice: 0,
			maxConcurrentDownloads: 3,
			display: {
				winType: 0,
				bgType: 1,
				bgOpacity: 1,
			},
			local: {
				toggleClick: 2,
				modView: 0,
				nsfw: 2,
			},
			online: {
				filter: "Mod",
				modView: 0,
				nsfw: 1,
			},
		},
		game: {
			launch: 0,
			hotReload: 1,
			customCategories: {},
		},
	} as Settings,
	SOURCE: "",
	TARGET: "",
	XXMI_MODE: 0 as 0 | 1,
	DATA: {} as ModDataObj,
	PRESETS: [] as Preset[],
	CATEGORIES: [] as Category[],
	TYPES: [] as Category[],
	CHANGES: { before: [], after: [], map: {}, skip: false, title: "" } as ChangeInfo,
	DOWNLOAD_LIST: {
		...{
			queue: [] as DownloadItem[],
			downloading: [] as DownloadItem[],
			completed: [] as DownloadItem[],
			extracting: [] as DownloadItem[],
		},
	},
	ONLINE: false,
	CURRENT_PRESET: -1,
	MOD_LIST: [] as Mod[],
	SELECTED: "",
	FILTER: {
		st: "all",
		src: "any",
		tag: {
			fav: "any",
			nsfw: "any",
		},
		upd: "any",
	} as Record<string, string | { [key: string]: string }>,
	SORT: "default",
	CATEGORY: new Set([]) as Set<string>,
	SEARCH: "",
	INSTALLED_ITEMS: [] as InstalledItem[],
	ONLINE_DATA: {} as OnlineData,
	ONLINE_TYPE: "Mod",
	ONLINE_SORT: "",
	ONLINE_PATH: "home&_type=Mod",
	ONLINE_SELECTED: "",
};
export const SORT_OPTIONS = Object.fromEntries(
	[
		{
			label: "Default",
			value: "default",
		},
		{
			label: "A - Z",
			value: "alpha-asc",
		},
		{
			label: "Z - A",
			value: "alpha-desc",
		},
		{
			label: "Favourite ↑",
			value: "fav-asc",
		},
		{
			label: "Favourite ↓",
			value: "fav-desc",
		},
		// {
		// 	label: "Source ↑",
		// 	value: "src-asc",
		// },
		// {
		// 	label: "Source ↓",
		// 	value: "src-desc",
		// },
		// {
		// 	label: "NSFW ↑",
		// 	value: "nsfw-asc",
		// },
		// {
		// 	label: "NSFW ↓",
		// 	value: "nsfw-desc",
		// },
		// {
		// 	label: "Enabled ↑",
		// 	value: "en-asc",
		// },
		// {
		// 	label: "Enabled ↓",
		// 	value: "en-desc",
		// },
	].map((opt) => [opt.value, opt.label])
);
info(SORT_OPTIONS);

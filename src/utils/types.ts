export type Games = "WW" | "ZZ" | "GI" | "SR" | "EF" | ""; //| "GI" ;
export type Language = "en" | "cn" | "ru" | "jp" | "kr" | "";
export interface DirEntry {
	name: string;
	isDirectory: boolean;
	icon?: string;
	children?: DirEntry[];
}
export interface GlobalSettings {
	clientDate: string;
	version?: string;
	lang: Language;
	XXMI: string;
	preReleases: boolean;
	ignore: string;
	game: Games;
	updatedAt?: string;
	notice?: number;
	chkModUpdates: boolean;
	maxConcurrentDownloads: number;
	display:{
		winType: 0 | 1 | 2;
		bgType: 0 | 1 | 2;
		bgOpacity: number;
	}
	local:{
		toggleClick: 0 | 2;
		modView: 0 | 1 | 2;
		nsfw: 0 | 1 | 2;
	}
	online:{
		filter: string;
		modView: 0 | 1 | 2;
		nsfw: 0 | 1 | 2;
	}
}
export interface GameSettings {
	launch: 0 | 1 | 2;
	hotReload: 0 | 1 | 2;
	customCategories: { [key: string]: CustomCategory };
}
export interface Settings {
	global: GlobalSettings;
	game: GameSettings;
}
export interface CustomCategory {
	_sIconUrl: string;
	_sAltIconUrl?: string;
}

export interface Category {
	_idRow: number;
	_sName: string;
	_nItemCount: number;
	_nCategoryCount: number;
	_sUrl: string;
	_sIconUrl: string;
	_sAltIconUrl?: string;
	_special?: boolean;
}
export interface ModData {
	source?: string;
	updatedAt?: number;
	installedAt?: number;
	addedAt?: number;
	viewedAt?: number;
	tags?: string[];
	note?: string;
	namespaces?: Record<string, string>;
	// state?: { [key: string]: any };
	vars?: Record<string, Record<string, ModVarValue>>;
	crop?: {
		scale?: number;
		x?: number;
		y?: number;
		vertical?: boolean;
	};
}
export interface ModVarValue {
	pref?: unknown;
	reset?: unknown;
	keyReset?: unknown;
	name?: string;
	state?: unknown;
}
export interface ModDataObj {
	[key: string]: ModData;
}
export interface Preset {
	name: string;
	data: string[];
	hotkey?: string;
}
export interface GameConfig {
	version: string;
	game: Games;
	custom: 0 | 1;
	sourceDir: string;
	targetDir: string;
	settings: GameSettings;
	data: ModDataObj;
	presets: Preset[];
	categories: Category[];
	updatedAt: string;
}
export interface DownloadItem {
	status: "pending" | "downloading" | "completed" | "failed" | "extracting";
	addon: boolean;
	preview: string;
	category: string;
	source: string;
	file: string;
	updated: number;
	name: string;
	fname: string;
	target?: string;
	key?: string;
	dlPath?: string;
	error?: string;
	path?: string;
	updatedAt?: number;
	operation?: "install" | "update";
}
export interface DownloadList {
	queue: DownloadItem[];
	downloading: DownloadItem[];
	completed: DownloadItem[];
	extracting: DownloadItem[];
}
export interface ModHotKeys {
	key: string;
	type: string;
	target: string;
	name: string;
	values: string[];
	default: string;
	file: string;
	namespace: string;
	pref: string | null;
	reset: string | null;
}
export interface Mod {
	name: string;
	parent: string;
	path: string;
	depth: number;
	isDir: boolean;
	enabled: boolean;
	children: Mod[];
	keys: ModHotKeys[];
	files?: Record<string, ModHotKeys[]>;
	namespace?: string;
	namespaces?: Set<string>;
	icon?: string;
	source?: string;
	updatedAt?: number;
	installedAt?: number;
	addedAt?: number;
	viewedAt?: number;
	note?: string;
	tags?: string[];
	hashes?: string[];
	crop?: {
		scale?: number;
		x?: number;
		y?: number;
		vertical?: boolean;
	};
	maxed: boolean;
}
export interface ProgressData {
	title: string;
	finished: boolean;
	button: string;
	open: boolean;
	name: string;
}
export interface ModCheckProgressData {
	open: boolean;
	checked: number;
	total: number;
}
export type ToastType = "success" | "error" | "info" | "warning";
export interface ToastData {
	id: number;
	type: ToastType;
	message: string;
	onClick: null | (() => void);
}
export interface NoticeData {
	heading: string;
	subheading: string;
	ignoreable: number;
	timer: number;
	ver: string;
	id: number;
}
export interface InstalledItem {
	name: string;
	source: string;
	updated: number;
	viewed: number;
	modStatus: number;
}
export interface OnlineModImage {
	_sType: string;
	_sBaseUrl: string;
	_sFile: string;
	_sFile220?: string;
	_hFile220?: number;
	_wFile220?: number;
	_sFile530?: string;
	_hFile530?: number;
	_wFile530?: number;
	_sFile100: string;
	_hFile100: number;
	_wFile100: number;
}
export interface OnlineModPreviewMedia {
	_aImages: OnlineModImage[];
}
export interface OnlineModSubmitter {
	_idRow: number;
	_sName: string;
	_bIsOnline: boolean;
	_bHasRipe?: boolean;
	_sProfileUrl: string;
	_sAvatarUrl: string;
	_sHdAvatarUrl: string;
	_sUpicUrl?: string;
	_sMoreByUrl?: string;
}
export interface OnlineModCategory {
	_sName: string;
	_sProfileUrl: string;
	_sIconUrl: string;
}
export interface OnlineMod {
	_idRow: number;
	_sModelName: string;
	_sSingularTitle?: string;
	_sIconClasses?: string;
	_sName: string;
	_sProfileUrl: string;
	_tsDateAdded?: number;
	_tsDateModified?: number;
	_tsDateUpdated?: number;
	_bHasFiles?: boolean;
	_aTags?: unknown[];
	_aFiles?: unknown[];
	_aPreviewMedia?: OnlineModPreviewMedia;
	_aSubmitter: OnlineModSubmitter;
	_aRootCategory: OnlineModCategory;
	_sVersion?: string;
	_bIsObsolete?: boolean;
	_sInitialVisibility: string;
	_bHasContentRatings?: boolean;
	_nLikeCount: number;
	_nPostCount: number;
	_bWasFeatured?: boolean;
	_nViewCount?: number;
	_bIsOwnedByAccessor?: boolean;
	_sImageUrl?: string;
	_aComments?: unknown[];
	_sPeriod?: "today" | "yesterday" | "week" | "month" | "3month" | "6month" | "year" | "alltime";
}
export interface OnlineData {
	[key: string]: OnlineMod[] | OnlineMod;
}
export interface ChangeInfo {
	before: DirEntry[];
	after: DirEntry[];
	map: Record<string, DirEntry>;
	title: string;
	skip: boolean;
}

import {
	CATEGORIES,
	DATA,
	DATA_PATH,
	ERR,
	FIRST_LOAD,
	GAME,
	IMM_UPDATE,
	LANG,
	MAIN_FUNC_STATUS,
	NOTICE,
	NOTICE_OPEN,
	ONLINE_DATA,
	PRESETS,
	resetAtoms,
	SAVED_LANG,
	SETTINGS,
	SOURCE,
	store,
	TARGET,
	TEXT_DATA,
	TYPES,
	UPDATER_OPEN,
	XXMI_DIR,
	XXMI_MODE,
} from "./vars";
import { check, type Update } from "@tauri-apps/plugin-updater";

import { path } from "@tauri-apps/api";
import { invoke } from "@tauri-apps/api/core";
// import { currentMonitor, PhysicalSize } from "@tauri-apps/api/window";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { atomicWriteTextFile, exists, mkdir, readTextFile, remove, writeTextFile } from "./fs";
import defConfig from "../default.json";
import defConfigXX from "../defaultXX.json";
import { apiClient } from "./api";
import { GAMES, VERSION } from "./consts";
import { switchGameTheme } from "./theme";
import { executeXXMI, isGameProcessRunning } from "./autolaunch";
// import { updateIni } from "./iniUpdater";
import { join, setHotreload, stopWindowMonitoring } from "./hotreload";
import { toInternal, toFs } from "./pathsep";
import { registerGlobalHotkeys } from "./hotkeyUtils";
import TEXT from "@/textData.json";
import { unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { isOlderThanOneDay, safeLoadJson, sanitizeFileName, setImageServer } from "./utils";
import { addToast } from "@/_Toaster/ToastProvider";
import { Category, Games, Preset, Settings } from "./types";
import { resetPageCounts } from "@/_Main/MainOnline";
import { info } from "@/lib/logger";
import { isVersionAtLeast, isVersionOlderThan } from "./semver";
// import { v2_0_4_migration } from "./filesys";
let paths = {
	"": "",
	exe: "",
	WW: "",
	ZZ: "",
	GI: "",
	SR: "",
	XX: "",
	EF: "",
};
let isInPrePostLaunch = {
	WW: false,
	ZZ: false,
	GI: false,
	SR: false,
	EF: false,
	"": false,
};
let target = "unknown";
let platform = "windows";
export function getPaths() {
	return paths;
}
let config: any = { ...defConfig };
let configXX: any = { ...defConfigXX };
let dataDir = "";
let appData = "";
let prevGame = "";
let categories: Category[] = [];
let isInitialized = false;
async function getXXMIConfig(path = store.get(XXMI_DIR)) {
	try {
		return JSON.parse(await readTextFile(join(path, "XXMI Launcher Config.json")));
	} catch (e) {
		info("[IMM] Failed to read XXMI Launcher config:", e);
		return null;
	}
}
export async function setPrePostLaunch(game: Games, value: boolean) {
	const data = await getXXMIConfig();
	if (!data) return;
	if (!data.Importers[game + "MI"]) return;
	const cmd = `start imm://mode/${game.toLowerCase()}`;
	if (value) {
		if (!data.Importers[game + "MI"].Importer.run_pre_launch.includes(cmd))
			data.Importers[game + "MI"].Importer.run_pre_launch = [
				cmd,
				...data.Importers[game + "MI"].Importer.run_pre_launch.split(" && "),
			]
				.filter((x: string) => x.trim() !== "")
				.join(" && ");
	} else {
		if (data.Importers[game + "MI"].Importer.run_pre_launch.includes(cmd)) {
			data.Importers[game + "MI"].Importer.run_pre_launch = data.Importers[game + "MI"].Importer.run_pre_launch
				.split(" && ")
				.filter((x: string) => x.trim() !== cmd)
				.join(" && ");
		}
		if (data.Importers[game + "MI"].Importer.run_post_load.includes(cmd)) {
			data.Importers[game + "MI"].Importer.run_post_load = data.Importers[game + "MI"].Importer.run_post_load
				.split(" && ")
				.filter((x: string) => x.trim() !== cmd)
				.join(" && ");
		}
	}
	await writeTextFile(join(store.get(XXMI_DIR), "XXMI Launcher Config.json"), JSON.stringify(data, null, 2));
}
export async function readXXMIConfig(path: string) {
	paths = {
		"": "",
		exe: "",
		WW: "",
		ZZ: "",
		GI: "",
		SR: "",
		XX: "",
		EF: "",
	};
	isInPrePostLaunch = {
		WW: false,
		ZZ: false,
		GI: false,
		SR: false,
		EF: false,
		"": false,
	};
	if (path && path != "") {
		const data = await getXXMIConfig(path);
		if (!data) return;
		// info("[IMM] Loaded XXMI Launcher config:", data);
		GAMES.forEach((game) => {
			if (data.Importers[game + "MI"]) {
				const xxPath = (data.Importers[game + "MI"].Importer.importer_folder || "").replace(/\\/g, "/");
				info(`[IMM] Resolved ${game}MI path:`, xxPath);
				paths[game as Games] = xxPath == `${game}MI/` ? join(path, `${game}MI`) : join(...xxPath.split("/"));
				const startCmd = `start imm://mode/${game.toLowerCase()}`;
				if (
					data.Importers[game + "MI"].Importer?.run_pre_launch.includes(startCmd) ||
					data.Importers[game + "MI"].Importer?.run_post_load.includes(startCmd)
				)
					isInPrePostLaunch[game as Games] = true;
			}
		});
		paths.XX = path;
		store.set(XXMI_DIR, path);
	}
	info("[IMM] Resolved game paths:", paths);
}
export function getDataDir() {
	return dataDir;
}
export function getPrevGame() {
	return prevGame;
}
export const window = getCurrentWebviewWindow();
export function changeWindowTitle(title: string) {
	window.setTitle(title);
}
export async function focusWindow() {
	try {
		if (window) {
			const isMinimized = await window.isMinimized();
			const maximized = sessionStorage.getItem("isMaximized") === "true";
			if (isMinimized) {
				await window.maximize();
				if (!maximized) await window.unmaximize();
			}
			await window.setAlwaysOnTop(true);
			await window.setAlwaysOnTop(false);
			await window.setFocus();
		}
	} catch (e) {
		console.log("[IMM] Failed to focus window:", e);
	}
}
export async function setWindowType(type: number) {
	if (type == 0) {
		window.unmaximize();
	} else if (type == 1) {
		window.unmaximize();
	} else if (type == 2) {
		window.maximize();
	}
}
invoke<string>("get_image_server_url").then((url) => {
	setImageServer(url + "/preview");
});
export async function setDataPath() {
	try {
		const res: string = await invoke("get_platform");
		if (res == "linux") {
			platform = "linux";
			target = await invoke("get_target");
			if(typeof target !== "string") target = "unknown";
			else target = target.toLowerCase();
			console.log("[IMM] Platform:", platform, "Target:", target);
			const dataDir = await path.appDataDir();
			if (!(await exists(dataDir))) {
				await mkdir(dataDir, { recursive: true });
			}
			store.set(DATA_PATH, dataDir);
		} else store.set(DATA_PATH, "");
	} catch (e) {
		store.set(DATA_PATH, "");
	}
}
export async function updateConfig(oconfig = null as any) {
	if (!oconfig) oconfig = JSON.parse(await readTextFile("config.json"));
	info("[IMM] Updating config from:", oconfig);
	if (isVersionAtLeast(oconfig.version, "3.1.1")) return oconfig;
	else if (isVersionAtLeast(oconfig.version, "2.1.0")) {
		let config = { ...oconfig, version: VERSION };
		try {
			config = {
				clientDate: oconfig.clientDate || "",
				version: VERSION,
				lang: oconfig.lang || "",
				XXMI: oconfig.XXMI || "",
				preReleases: oconfig.preReleases || false,
				chkModUpdates: oconfig.chkModUpdates || false,
				ignore: oconfig.ignore || "3.1.0",
				game: oconfig.game || "",
				updatedAt: oconfig.updatedAt || "",
				notice: oconfig.notice ?? 0,
				display: {
					winType: oconfig.winType ?? 0,
					bgType: oconfig.bgType ?? 2,
					bgOpacity: oconfig.bgOpacity ?? 1,
				},
				local: {
					toggleClick: oconfig.toggleClick ?? 2,
					modView: 0,
					nsfw: 2,
				},
				online: {
					filter: "Mod",
					modView: 0,
					nsfw: oconfig.nsfw ?? 1,
				},
			};
		} catch (e) {
			info("[IMM] Failed to update config:", e);
		}
		return config;
	}
	let config = {
		version: VERSION,
		updatedAt: new Date().toISOString(),
		bgOpacity: oconfig.settings.opacity || 1,
		winOpacity: 1,
		winType: oconfig.settings.type || 0,
		bgType: oconfig.settings.bgType || 2,
		listType: 0,
		nsfw: oconfig.settings.nsfw || 1,
		toggleClick: oconfig.settings.toggle || 2,
		ignore: "2.0.4",
		clientDate: oconfig.settings.clientDate || "",
		XXMI: "",
		lang: oconfig.settings.lang || "",
		game: "",
	};
	let data = oconfig.data || {};
	let keys = Object.keys(data);
	for (let key of keys) {
		if (key.startsWith("\\")) {
			data[key.substring(1)] = data[key];
			delete data[key];
		}
	}
	let presets = oconfig.presets.map((preset: Preset) => {
		let newPreset: Preset = { name: preset.name || "Preset", data: [], hotkey: preset?.hotkey || "" };
		if (preset.data && Array.isArray(preset.data)) {
			newPreset.data = preset.data.map((item: string) => (item.startsWith("\\") ? item.substring(1) : item));
		}
		return newPreset;
	});
	await writeTextFile(
		`configWW.json`,
		JSON.stringify(
			{
				version: VERSION,
				categories: [],
				settings: {
					launch: oconfig.settings.launch || 0,
					hotReload: oconfig.settings.hotReload || 1,
					onlineType: oconfig.settings.onlineType || "Mod",
				},
				data: oconfig.data || {},
				presets: presets || [],
				updatedAt: new Date().getTime(),
			},
			null,
			2
		)
	);
	store.set(FIRST_LOAD, true);
	return config;
}
export async function verifyGameDir(game: Games) {
	const XXPath = paths[game];
	const dirs = {
		targetDir: "",
		sourceDir: "",
	};
	try {
		(await readTextFile(join(XXPath, "d3dx.ini"))).split("\n").forEach((line: string) => {
			const [key, value] = line.split("=").map((x: string) => x.trim());
			if (key == "include_recursive") {
				const isPath = value.slice(1, 3) == ":\\" || value.startsWith("/");
				dirs.targetDir = isPath ? value : join(XXPath, value);
				dirs.sourceDir = isPath ? value : join(XXPath, value);
			}
		});
	} catch (e) {
		info(`[IMM] Failed to read d3dx.ini for ${game}:`, e);
		dirs.sourceDir = "";
		dirs.targetDir = "";
	}
	return dirs;
}
export async function initGame(game: Games, status = true) {
	info(`[IMM] Initializing game: ${game}...`);
	store.set(ONLINE_DATA, {});
	if (await exists(`config${game}.json`)) {
		configXX = JSON.parse(await readTextFile(`config${game}.json`));
	} else configXX = { ...defConfigXX };
	const defKeys = Object.keys(defConfigXX);
	defKeys.forEach((key) => {
		if (!(key in configXX)) {
			(configXX as any)[key] = (defConfigXX as any)[key];
		}
	});
	configXX.game = game;
	if (configXX.settings.launch === 2 && !isInPrePostLaunch[game]) configXX.settings.launch = 0;
	else if (isInPrePostLaunch[game]) configXX.settings.launch = 2;
	switchGameTheme(game);

	if (!configXX.custom) {
		configXX = { ...configXX, ...(await verifyGameDir(game)) };
	} else {
		dataDir = configXX.targetDir;
	}

	const normalizedData = {} as any;
	Object.keys(configXX.data || {}).forEach((key) => {
		const normalizedKey = key.replace(/[/\\]+/g, "\\").replace(/^\\+/, "");
		normalizedData[normalizedKey] = { ...normalizedData[normalizedKey], ...(configXX.data as any)[key] };
	});
	configXX.data = normalizedData;

	const normalizedPresets = (configXX.presets || []).map((preset: any) => ({
		...preset,
		data: (preset.data || []).map((p: string) => p.replace(/[/\\]+/g, "\\").replace(/^\\+/, "")),
	}));
	configXX.presets = normalizedPresets;

	await atomicWriteTextFile(`config${game}.json`, JSON.stringify(configXX, null, 2));
	apiClient.setGame(game as any);
	await setCategories(game, status);
	invoke("set_window_icon", { game });
	// Validate source and target dirs
	if (configXX.sourceDir && !(await exists(join(configXX.sourceDir)))) configXX.sourceDir = "";
	if (configXX.targetDir && !(await exists(configXX.targetDir))) configXX.targetDir = "";
	status && store.set(MAIN_FUNC_STATUS, "Validating source and target directories");
	info("[IMM] Validating source and target directories...", configXX.sourceDir, configXX.targetDir);
	store.set(SOURCE, configXX.sourceDir || "");
	store.set(TARGET, configXX.targetDir || "");
	store.set(XXMI_MODE, configXX.custom || 0);
	store.set(
		SETTINGS,
		(prev) => ({ global: { ...prev.global, game }, game: { ...prev.game, ...configXX.settings } }) as Settings
	);
	store.set(TYPES, apiClient.generic.types);
	if (
		(configXX.version && isVersionOlderThan(configXX.version, "3.1.0")) ||
		(configXX.updatedAt && configXX.updatedAt < "2026-02-24T13:30:00.000Z")
	) {
		Object.keys(configXX.data).forEach((key) => {
			if (!configXX.data[key].addedAt)
				configXX.data[key].addedAt =
					configXX.data[key].updatedAt > 1 ? configXX.data[key].updatedAt : configXX.data[key].viewedAt || Date.now();
		});
	}
	store.set(DATA, configXX.data || {});
	store.set(PRESETS, configXX.presets || []);
	return configXX;
}
store.sub(SETTINGS, async () => {
	const settings = store.get(SETTINGS);
	if (isInitialized) {
		config = { ...config, ...settings.global };
		configXX = { ...configXX, settings: { ...configXX.settings, ...settings.game } };
	}
	if (settings.global.game != store.get(GAME)) store.set(GAME, settings.global.game);
});
store.sub(SAVED_LANG, () => {
	const lang = store.get(SAVED_LANG);
	store.set(TEXT_DATA, TEXT[store.get(SAVED_LANG) as "en"] || TEXT["en"]);
	if (lang) {
		store.set(LANG, lang);
	}
});
export async function setCategories(game = prevGame, status = true) {
	console.log("[IMM] Waiting to setup data path");
	while (store.get(DATA_PATH) == null) {
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	info("[IMM] Setting categories...");

	if (!game) return;
	prevGame = game;
	try {
		status && store.set(MAIN_FUNC_STATUS, "Fetching game categories from Gamebanana");
		categories = await apiClient.categories();
		if (!categories || categories.length == 0) throw "No categories found, please verify the directories again";
	} catch (e) {
		status && store.set(MAIN_FUNC_STATUS, "Unable to reach Gamebanana");
		info("[IMM] Failed to fetch categories from API, using local config if available.", e);
		categories =
			configXX.categories && configXX.categories.length > 0
				? configXX.categories
				: [...apiClient.categoryList, ...apiClient.generic.categories];
	} finally {
		if (!categories || categories.length == 0) return;
		const catObj: { [key: string]: Category } = {};
		categories.forEach((cat) => {
			catObj[cat._sName] = cat;
		});
		const customCats = configXX.settings.customCategories || {};
		for (let key of Object.keys(customCats)) {
			catObj[key] = { ...catObj[key], _sName: key, ...customCats[key] };
		}
		categories = Object.values(catObj).map((cat) => ({
			...cat,
			_sIconUrl: cat._sIconUrl || "/who.jpg",
			_sName: sanitizeFileName(cat._sName),
		}));
		store.set(CATEGORIES, categories);
	}
}
function removeHelpers() {
	stopWindowMonitoring();
	unregisterAll();
	resetPageCounts();
}
export async function launchGame() {
	if (await exists(config.XXMI))
		isGameProcessRunning(config.game).then((running) => {
			if (!running) {
				executeXXMI(toFs(join(config.XXMI, "Resources\\Bin\\XXMI Launcher.exe")));
				addToast({
					type: "info",
					message: "Launching Game",
				});
			}
		});
}
async function initHelpers() {
	info("[IMM] Initializing helpers...");
	if (configXX.settings.launch == 1 && GAMES.includes(config.game)) {
		launchGame();
	}
	setHotreload(configXX.settings.hotReload as 0 | 1 | 2, config.game, configXX.targetDir);

	registerGlobalHotkeys();
}
export async function checkWWMM() {
	info("[IMM] Checking for WWMM config...");
	const wwmmPath = await path.join(await path.localDataDir(), "Wuwa Mod Manager (WWMM)", "config.json");
	if (await exists(wwmmPath)) {
		//info('exists')
		return (await readTextFile(wwmmPath)) || null;
	}
	return null;
}
export async function maintainBackups(): Promise<boolean> {
	info("[IMM] Maintaining backups...");
	store.set(MAIN_FUNC_STATUS, "Maintaining backups");
	const files = GAMES.map((g) => `config${g}.json`);
	files.push("config.json");
	await mkdir("backups", { recursive: true });
	let recoverySucceeded = true;
	const backupPath = "backups\\AUTO_";
	for (const file of files) {
		if (await exists(file)) {
			try {
				const data = JSON.parse(await readTextFile(file));
				delete data.categories;
				if (await exists(backupPath + file + ".bak")) {
					try {
						const backupData = JSON.parse(await readTextFile(backupPath + file + ".bak"));
						if (
							backupData.updatedAt &&
							new Date().getTime() - new Date(backupData.updatedAt).getTime() > 24 * 60 * 60 * 1000
						) {
							info(`[IMM] Creating backup for: ${file}...`);
							try {
								await remove(backupPath + file + ".bak.bak");
							} catch {}
							await writeTextFile(backupPath + file + ".bak.bak", await readTextFile(backupPath + file + ".bak"));
							await writeTextFile(backupPath + file + ".bak", JSON.stringify(data, null, 2));
						}
					} catch {
						info(`[IMM] Detected corrupted backup file: ${file}.bak, creating new backup...`);
						await writeTextFile(backupPath + file + ".bak", JSON.stringify(data, null, 2));
					}
				} else {
					info(`[IMM] Creating initial backup for: ${file}...`);
					await writeTextFile(backupPath + file + ".bak", JSON.stringify(data, null, 2));
				}
			} catch (e) {
				console.log(e);
				info(`[IMM] Detected corrupted config file: ${file}, restoring from backup...`);
				store.set(MAIN_FUNC_STATUS, `Config file corrupted, restoring from backup`);
				if (await exists(backupPath + file + ".bak")) {
					try {
						const backupData = JSON.parse(await readTextFile(backupPath + file + ".bak"));
						await writeTextFile(file, JSON.stringify(backupData, null, 2));
						info(`[IMM] Successfully restored backup for: ${file}`);
					} catch (e) {
						info(`[IMM] Detected corrupted backup config file: ${file}.bak, restoring from secondary backup...`);
						if (await exists(backupPath + file + ".bak.bak")) {
							try {
								const backupData2 = JSON.parse(await readTextFile(backupPath + file + ".bak.bak"));
								await writeTextFile(file, JSON.stringify(backupData2, null, 2));
								await writeTextFile(backupPath + file + ".bak", JSON.stringify(backupData2, null, 2));
								info(`[IMM] Successfully restored secondary backup for: ${file}`);
							} catch (e) {
								info(`[IMM] Failed to restore secondary backup for: ${file}:`, e);
								info(`[IMM] Manual intervention required to fix config file: ${file}`);
								store.set(
									ERR,
									`Corrupted config file detected: ${file}, ${backupPath + file + ".bak"} & ${
										backupPath + file + ".bak.bak"
									}. Unable to proceed, please restore manually or press ESC x3 to reset IMM.`
								);
								recoverySucceeded = false;
							}
						} else {
							store.set(
								ERR,
								`Corrupted config file detected: ${file} & ${
									backupPath + file + ".bak"
								}. Unable to proceed, please restore manually or press ESC x3 to reset IMM.`
							);
							recoverySucceeded = false;
						}
					}
				} else {
					info(`[IMM] No backup found for corrupted config file: ${file}. Manual intervention required.`);
					store.set(
						ERR,
						`Corrupted config file detected: ${file}. Unable to proceed, please restore manually or press ESC x3 to reset IMM.`
					);
					recoverySucceeded = false;
				}
			}
		}
	}
	return recoverySucceeded;
}
let cwd = "";
export function getCwd() {
	return cwd;
}
export async function main(useGame = "" as Games) {
	store.set(MAIN_FUNC_STATUS, "Initializing App");
	isInitialized = false;
	info("[IMM] Initializing application...");
	await invoke("get_username");
	resetAtoms();
	removeHelpers();
	appData = toInternal(await path.dataDir());
	if(store.get(DATA_PATH) && platform == "linux") 
		cwd = store.get(DATA_PATH) || join(await path.localDataDir(), "Integrated Mod Manager (IMM)");
	else
		cwd = join(await path.localDataDir(), "Integrated Mod Manager (IMM)");
	const XXMI = `${appData}\\XXMI Launcher`;
	if (!(await exists("config.json"))) {
		store.set(MAIN_FUNC_STATUS, "Creating default config.json");
		info("[IMM] Creating default config.json...");
		await atomicWriteTextFile("config.json", JSON.stringify(defConfig, null, 2));
	}
	if (!(await maintainBackups())) {
		throw new Error("Configuration recovery failed. See the on-screen error for recovery instructions.");
	}
	config = safeLoadJson(defConfig, JSON.parse(await readTextFile("config.json")));
	if (isVersionOlderThan(config.version, "2.2.0")) {
		config.chkModUpdates = true;
		config.bgType = 1;
	}
	info("[IMM] Loaded config:", config);
	store.set(MAIN_FUNC_STATUS, "Config loaded");
	const savedLang = store.get(SAVED_LANG);
	if (!savedLang && config.lang) {
		store.set(SAVED_LANG, config.lang);
	}
	config.lang = store.get(SAVED_LANG) || config.lang;
	if (!config.XXMI && !config.game && !config.lang) {
		store.set(MAIN_FUNC_STATUS, "First time setup detected, checking for WWMM");
		info("[IMM] First time setup detected, checking for WWMM...");
		store.set(FIRST_LOAD, true);
		const temp = await checkWWMM();
		if (temp) config = await updateConfig(JSON.parse(temp));
	} else {
		store.set(FIRST_LOAD, false);
	}
	apiClient.setClient(config.clientDate || "");
	if ((config.XXMI == "" || !(await exists(config.XXMI))) && (await exists(XXMI))) {
		config.XXMI = XXMI;
	}
	paths.XX = config.XXMI;
	config.game = useGame || config.game;
	if (sessionStorage.getItem("imm-deep-link-game")) {
		config.game = sessionStorage.getItem("imm-deep-link-game") as Games;
		config.game = GAMES.includes(config.game) ? config.game : "";
		sessionStorage.removeItem("imm-deep-link-game");
	}
	if (config.game) apiClient.setGame(config.game);
	if (isVersionOlderThan(config.version, "2.1.0")) {
		config = await updateConfig();
	}
	if (isVersionOlderThan(config.version, "3.1.0")) {
		config = await updateConfig();
	}
	info("[IMM] Saving config...");
	await atomicWriteTextFile("config.json", JSON.stringify(config, null, 2));
	await readXXMIConfig(config.XXMI || "");
	store.set(MAIN_FUNC_STATUS, "Initializing game");
	info("[IMM] Initializing game...");
	if (config.game) configXX = await initGame(config.game);
	info("[IMM] Setting window type...");
	if (config.display?.winType > 1) setWindowType(config.display.winType);
	const bg = document.querySelector("body");
	if (bg)
		bg.style.backgroundColor =
			"color-mix(in oklab, var(--background) " + config.display?.bgOpacity * 100 + "%, transparent)";

	store.set(SETTINGS, (prev) => ({
		global: { ...prev.global, ...config },
		game: { ...prev.game, ...configXX.settings },
	}));
	initHelpers();
	isInitialized = true;
	store.set(MAIN_FUNC_STATUS, "fin");
	let update: Update | null = null;
	try {
		const timeoutPromise = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error("Update check timeout")), 10000)
		);
		update = await Promise.race([check(platform == "linux" ? { target: platform + "-" + target } : {}), timeoutPromise]);
	} catch (error) {
		console.error("[IMM] Update check failed:", error);
		update = null;
	}
	if (update) {
		let lang = config.lang || "en";
		let parsedBody: any = {};
		if (update.body) {
			try {
				parsedBody = JSON.parse(update.body);
				parsedBody = parsedBody[lang as keyof typeof parsedBody] || parsedBody;
			} catch (e) {
				parsedBody = {};
			}
		}
		const notice = parsedBody.notice || {};
		const lastConfig = config.notice || 0;
		let noticeOpen = false;
		if (
			(notice.id > 0 && notice.ver > VERSION) ||
			((notice.id > lastConfig || notice.ignoreable === 0) && notice.ver == VERSION)
		) {
			store.set(NOTICE, (prev: any) => ({ ...prev, ...notice }));
			if (notice.id !== lastConfig || notice.ignoreable == 0) {
				noticeOpen = true;
				store.set(NOTICE_OPEN, noticeOpen);
			}
		}

		const show = config.preReleases || isOlderThanOneDay(update.date || "");
		store.set(IMM_UPDATE, {
			version: update.version,
			date: update.date || "",
			body: JSON.stringify(parsedBody) || "{}",
			status: show ? "available" : "ignored",
			raw: update,
		});
		if (!noticeOpen && update.version > config.ignore && show) {
			store.set(UPDATER_OPEN, true);
		}
		store.set(SETTINGS, (prev) => ({
			...prev,
			global: {
				...prev.global,
				notice: notice.id,
				ignore: update.version,
			},
		}));
	}
}

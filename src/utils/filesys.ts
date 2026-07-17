import defConfig from "../default.json";
import { copyFile, exists, mkdir, readDir, readTextFile, remove, rename, writeFile, writeTextFile } from "./fs";
import {
	exts,
	IGNORE,
	INI_BACKUP,
	managedSRC,
	managedTGT,
	OLD_managedSRC,
	OLD_managedTGT,
	OLD_RESTORE,
	PREFS,
	RESTORE,
	UNCATEGORIZED,
	VERSION,
} from "./consts";
import {
	BACKUP_INI,
	CATEGORIES,
	DATA,
	DOWNLOAD_LIST,
	ERR,
	LAST_UPDATED,
	MOD_LIST,
	PRESETS,
	PROGRESS_OVERLAY,
	SETTINGS,
	SOURCE,
	store,
	TARGET,
	TEXT_DATA,
	XXMI_DIR,
	XXMI_MODE,
} from "./vars";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { join, iniPath, getModData } from "./hotreload";
import { toFs, toInternal } from "./pathsep";
import { main, updateConfig } from "./init";
import { addToast } from "@/_Toaster/ToastProvider";
import MiniSearch from "minisearch";
import { ChangeInfo, DirEntry, GameConfig, GlobalSettings, Mod, ModDataObj, ModHotKeys } from "./types";
import { openPath } from "@tauri-apps/plugin-opener";
import { error, info, warn } from "@/lib/logger";
import { addToExtracts } from "@/_LeftSidebar/components/Downloads";
import { isVersionOlderThan } from "./semver";
import { trackUserAction } from "./userStats";
export async function setGame(game: string) {
	try {
		const config = await readTextFile(`config.json`);
		const parsedConfig = JSON.parse(config);
		parsedConfig.game = game;
		await writeTextFile(`config.json`, JSON.stringify(parsedConfig, null, 2));
		return true;
	} catch {
		try {
			if (!(await exists(`config.json`))) {
				await writeTextFile(`config.json`, JSON.stringify({ ...defConfig, game }, null, 2));
				return true;
			}
			throw new Error("Config file exists but could not be read or updated.");
		} catch {
			return false;
		}
	}
}
const textMSG = {
	rem: "Removing current files",
	disc: "Discovering files",
	file: "File",
};
let completedFiles = 0;
let totalFiles = 0;
let canceled = false;
let result = "Ok";
let progressBar: HTMLElement | null = null;
let progressMessage: HTMLElement | null = null;
let progressPerct: HTMLElement | null = null;
// Initialize Intl.Collator for faster string comparison
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const sp = [UNCATEGORIZED, IGNORE, OLD_RESTORE];
let recentlyDownloaded: string[] = [];
store.sub(DOWNLOAD_LIST, () => {
	recentlyDownloaded = store.get(DOWNLOAD_LIST).completed.map((item: any) => item.path);
});
let modMap: Record<string, Mod> = {};
store.sub(MOD_LIST, () => {
	const modList = store.get(MOD_LIST) || [];
	modMap = {};
	modList.forEach((mod: Mod) => {
		modMap[mod.path] = mod;
	});
});
let src = "";
let rootReplace = "";
let modRoot = "";
let tgt = "";
let textData = store.get(TEXT_DATA);
store.sub(TEXT_DATA, () => {
	textData = store.get(TEXT_DATA);
});
store.sub(SOURCE, () => {
	src = store.get(SOURCE);
	modRoot = join(src, managedSRC);
	rootReplace = modRoot;
});
store.sub(TARGET, () => {
	tgt = store.get(TARGET);
});
let catDB: MiniSearch | null = null;
store.sub(CATEGORIES, () => {
	try {
		const categories = store.get(CATEGORIES) || [];
		catDB = new MiniSearch({
			idField: "_sName",
			fields: ["_sName"],
			storeFields: ["_sName", "_sIconUrl"],
			searchOptions: {
				boost: { name: 2 },
				fuzzy: 0.2,
			},
		});
		catDB.addAll([...categories, { _sName: UNCATEGORIZED, _sIconUrl: "" }]);
	} catch (e) {
		console.error("Error building category search index:", e);
	}
});
export async function setConfig(config: any) {
	info("[IMM] Setting config...");
	if (!config) return;
	if (config.version && isVersionOlderThan(config.version, "2.1.0")) {
		info("[IMM] Old config version, migrating...");
		await updateConfig(config);
		addToast({ type: "success", message: textData._Toasts.SuccessPort });
		main();
		return;
	}
	let { gameConfig: curConfig } = getConfig(store.get(SETTINGS));
	info("[IMM] Current config:", { ...curConfig });
	info("[IMM] New config:", config);
	if (!curConfig.game || !config.game || curConfig.game !== config.game) {
		addToast({ type: "error", message: textData._Toasts.GameConfigMismatch });
		return;
	}
	config.version = VERSION;
	await writeTextFile(`config${curConfig.game}.json`, JSON.stringify(config, null, 2));
	addToast({ type: "success", message: textData._Toasts.ConfigLoaded });
	await main();
	//EDIT AFTER MERGE
	// store.set(MOD_LIST, await refreshModList());
}
export function getConfig(settings = store.get(SETTINGS)) {
	const config: GlobalSettings = settings.global;
	config["updatedAt"] = new Date().toISOString();
	config["version"] = VERSION;
	config["XXMI"] = store.get(XXMI_DIR) || "";
	const xxmiMode = store.get(XXMI_MODE) || 0;
	const gameConfig: GameConfig = {
		version: VERSION,
		custom: xxmiMode,
		sourceDir: xxmiMode ? store.get(SOURCE) || "" : "",
		targetDir: xxmiMode ? store.get(TARGET) || "" : "",
		game: settings.global.game,
		settings: settings.game,
		data: store.get(DATA) || {},
		presets: store.get(PRESETS) || [],
		updatedAt: new Date().toISOString(),
		categories: store.get(CATEGORIES) || [],
	};
	return { config, gameConfig };
}
export async function saveConfigs(skip = false, settings = store.get(SETTINGS)) {
	info("[IMM] Saving configs...");
	try {
		const { config, gameConfig } = getConfig(settings);
		const promises: Promise<void>[] = [];
		promises.push(writeTextFile("config.json", JSON.stringify(config, null, 2)));
		if (config.game && !skip) {
			promises.push(writeTextFile(`config${config.game}.json`, JSON.stringify(gameConfig, null, 2)));
		}
		await Promise.all(promises);
	} catch (error) {
		//console.error("Error saving configs:", error);
		throw error;
	}
}
export async function selectPath(
	options = { multiple: false, directory: false } as {
		multiple?: boolean;
		directory?: boolean;
		defaultPath?: string;
		title?: string;
		filters?: { name: string; extensions: string[] }[];
	}
) {
	const { defaultPath, ...rest } = options;
	const result = (await open({ ...rest, ...(defaultPath ? { defaultPath: toFs(defaultPath) } : {}) })) as
		| string
		| string[]
		| null;
	if (typeof result === "string") return toInternal(result);
	if (Array.isArray(result)) return result.map((p) => toInternal(p));
	return result;
}
export function folderSelector(path = "", title: string | undefined = undefined): Promise<string | null> {
	return selectPath({
		directory: true,
		...(path ? { defaultPath: path } : {}),
		...(title ? { title } : {}),
	}) as Promise<string | null>;
}
function replaceDisabled(name: string) {
	return name.replace("DISABLED_", "").replace("DISABLED", "").trim();
}
function formatDateTime() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(
		2,
		"0"
	)}-${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(
		now.getSeconds()
	).padStart(2, "0")}`;
}
/**
 * Optimized sorting function using Intl.Collator for better performance
 * Handles case-insensitive sorting with uppercase precedence for same letters
 */
function sortMods(a: Mod | DirEntry, b: Mod | DirEntry) {
	const x = replaceDisabled(a.name);
	const y = replaceDisabled(b.name);

	// Use Intl.Collator for faster comparison
	const comparison = collator.compare(x, y);

	if (comparison !== 0) {
		return comparison;
	}

	// If names are equal after collation, prioritize uppercase
	const xFirstLower = x[0]?.toLowerCase();
	const yFirstLower = y[0]?.toLowerCase();

	if (xFirstLower === yFirstLower) {
		const xIsUpper = x[0] === x[0]?.toUpperCase();
		const yIsUpper = y[0] === y[0]?.toUpperCase();

		if (xIsUpper && !yIsUpper) return 1;
		if (!xIsUpper && yIsUpper) return -1;
	}

	return 0;
}
async function copyDir(src: string, dest: string, withProgress = false) {
	try {
		await mkdir(dest, { recursive: true });
		const entries = (await readDir(src)).filter(
			(item) =>
				!withProgress ||
				(item.name !== RESTORE &&
					item.name !== IGNORE &&
					item.name !== PREFS &&
					item.name !== managedSRC &&
					item.name !== managedTGT)
		);
		for (const entry of entries) {
			if (withProgress && canceled) {
				if (result == "Ok") result = "Operation Cancelled";
				return;
			}
			const srcPath = join(src, entry.name);
			const destPath = join(dest, entry.name);
			if (!entry.isDirectory) {
				await copyFile(srcPath, destPath);
				if (withProgress) {
					completedFiles++;
					if (progressBar && progressPerct && progressMessage) {
						const percentage = ((completedFiles / totalFiles) * 100).toFixed(2);
						progressBar.style.width = percentage + "%";
						progressPerct.innerText = percentage + "%";
						progressMessage.innerText = `${textMSG.file} ${completedFiles}/${totalFiles}: ${join(
							src.replace(rootReplace, ""),
							entry.name
						)}`;
					}
				}
			} else {
				await copyDir(srcPath, destPath, withProgress);
			}
		}
	} catch (error) {
		canceled = true;
		result = "An Error Occurred";
		//console.error("Error copying directory:", error);
		throw error;
	}
}

async function countFilesInDir(path: string) {
	let entries = (await readDir(join(path, ""))).filter(
		(item) => item.name != RESTORE && item.name != IGNORE && item.name != PREFS
	);
	for (let entry of entries) {
		if (entry.isDirectory) {
			await countFilesInDir(join(path, entry.name));
		} else {
			totalFiles++;
			if (progressMessage) {
				progressMessage.innerText = textMSG.disc + " ( " + totalFiles + " / ? )";
			}
		}
	}
}
export function cancelRestore() {
	info("[IMM] Cancelling restore operation...");
	canceled = true;
}
export async function getRestorePoints(): Promise<string[]> {
	info("[IMM] Getting restore points...");
	try {
		const restoreDir = join(modRoot, RESTORE);
		if (!(await exists(restoreDir))) return [];
		const entries = await readDir(restoreDir);
		return entries
			.filter((item) => item.isDirectory)
			.map((item) => item.name)
			.sort()
			.reverse();
	} catch (error) {
		//console.error("Error getting restore points:", error);
		return [];
	}
}
export async function resetWithBackup() {
	info("[IMM] Resetting with backup...");
	const configs = ["", "WW", "ZZ", "GI", "SR", "EF"];
	for (let cfg of configs) {
		try {
			await rename(`config${cfg}.json`, `backups/MAN_${Date.now()}_config${cfg}.json.bak`);
		} catch {}
	}
	window.location.reload();
}
export async function previewRestorePoint(point: string) {
	info("[IMM] Previewing restore point:", point);
	let path = join(modRoot, RESTORE, point);
	if (!(await exists(path))) return [];
	let entries = await readDirRecr(path, "", 2);
	let categories = store.get(CATEGORIES) || [];
	//info(entries);
	return entries.map((entry: Mod) => {
		let category = categories.find((cat) => cat._sName == entry.name);
		if (category && entry.isDir) entry.icon = category._sIconUrl;
		return entry;
	});
}
export async function sourceBatchPreview(newCategory = "" as string) {
	info("[IMM] Previewing source batch...");
	let path = src;
	if (!(await exists(path))) return [];
	let categories = store.get(CATEGORIES) || [];
	try {
		if (newCategory) {
			await mkdir(join(modRoot, newCategory), { recursive: true });
		}
	} catch {}
	let entries = (await readDirRecr(path, "", 2)).map((entry: Mod) => {
		if (entry.name === managedSRC) {
			// entry.icon = "IMM2.png";

			entry.children.map((child: Mod) => {
				let category = categories.find((cat) => cat._sName == child.name);
				if (category && child.isDir) child.icon = category._sIconUrl;
				return child;
			});
		} else if (entry.name === managedTGT) {
			// entry.icon = "IMM2.png";
		}
		return entry;
	});
	info("[WWW]", entries);
	return entries;
}
export async function addToBatchPreview(opath: string) {
	info("[IMM] Adding to source batch preview:", opath);
	const path = join(src, opath);
	if (!(await exists(path))) return [];
	let entries = await readDirRecr(path, "", 0);
	info("[WWW]", path, " -> ", entries);
	return entries.map((entry: Mod) => {
		entry.path = join(opath, entry.path);
		entry.parent = opath;
		return entry;
	});
}
export async function restoreFromPoint(point: string) {
	info("[IMM] Restoring from point:", point);
	let path = join(modRoot, RESTORE, point);
	if (!(await exists(path))) return null;
	store.set(PROGRESS_OVERLAY, {
		title: "Restoring from " + name,
		finished: false,
		button: "Cancel",
		open: true,
		name: point,
	});
	progressBar = document.querySelector("#restore-progress");
	progressMessage = document.querySelector("#restore-progress-message");
	progressPerct = document.querySelector("#restore-progress-percentage");
	while (!progressBar || !progressMessage || !progressPerct) {
		await new Promise((resolve) => setTimeout(resolve, 10));
		progressBar = progressBar || document.querySelector("#restore-progress");
		progressMessage = progressMessage || document.querySelector("#restore-progress-message");
		progressPerct = progressPerct || document.querySelector("#restore-progress-percentage");
	}
	progressMessage.innerText = textMSG.rem;
	let entries = (await readDir(modRoot)).filter((item) => item.name != RESTORE);
	for (let entry of entries) {
		try {
			await remove(join(modRoot, entry.name), { recursive: true });
		} catch {}
	}
	progressMessage.innerText = textMSG.disc;
	completedFiles = 0;
	totalFiles = 0;
	canceled = false;
	if (canceled) {
		result = "Operation Cancelled";
	} else {
		await countFilesInDir(path);
		result = "Ok";
		rootReplace = join(modRoot, RESTORE, point);
		await copyDir(path, point.startsWith("ORG") ? src : modRoot, true);
	}
	store.set(PROGRESS_OVERLAY, (prev) => ({
		title: result == "Ok" ? "Restoration Completed" : result,
		finished: true,
		button: "Close",
		open: prev.open,
		name: point,
	}));
	return null;
}
export async function createRestorePoint(prefix = "") {
	info("[IMM] Creating restore point with prefix:", prefix);
	store.set(PROGRESS_OVERLAY, {
		title: "Creating Restore Point",
		button: "Cancel",
		finished: false,
		open: true,
		name: prefix,
	});
	progressBar = document.querySelector("#restore-progress");
	progressMessage = document.querySelector("#restore-progress-message");
	progressPerct = document.querySelector("#restore-progress-percentage");
	while (!progressBar || !progressMessage || !progressPerct) {
		await new Promise((resolve) => setTimeout(resolve, 10));
		progressBar = progressBar || document.querySelector("#restore-progress");
		progressMessage = progressMessage || document.querySelector("#restore-progress-message");
		progressPerct = progressPerct || document.querySelector("#restore-progress-percentage");
	}
	progressMessage.innerText = textMSG.disc;
	completedFiles = 0;
	totalFiles = 0;
	canceled = false;
	try {
		await mkdir(join(modRoot, RESTORE), { recursive: true });
	} catch (e) {}

	let restorePointName = prefix + "RESTORE-" + formatDateTime();
	const root = !prefix ? modRoot : src;
	rootReplace = root;
	await countFilesInDir(root);
	try {
		await mkdir(join(modRoot, RESTORE, restorePointName));
	} catch (e) {
		return false;
	}
	result = "Ok";
	await copyDir(root, join(modRoot, RESTORE, restorePointName), true);
	if (canceled) {
		if (result == "Ok") result = "Operation Cancelled";
		await remove(join(modRoot, RESTORE, restorePointName), { recursive: true });
		try {
			await remove(join(modRoot, RESTORE));
			await remove(join(modRoot));
		} catch (e) {}
	}
	store.set(PROGRESS_OVERLAY, (prev) => ({
		title: result == "Ok" ? "Restore Point Created" : result,
		button: "Close",
		finished: true,
		open: prev.open,
		name: prefix,
	}));
	return result == "Ok";
}
export async function checkOldVerDirs(src: string) {
	try {
		let checkFolders = 0;
		const entries = await readDir(src);
		for (const i of entries) {
			if (i.isDirectory && sp.includes(i.name)) {
				checkFolders++;
			}
		}
		return checkFolders === 3;
	} catch (error) {
		//console.error("Error checking old version directories:", error);
		return false;
	}
}
export async function categorizeDir(src: string, modifyIni = false) {
	info("[IMM] Categorizing directory:", src, "Skip restore:", modifyIni);
	const d3dx_path = join(...tgt.split(/[/\\]/).slice(0, -1), "d3dx_user.ini");
	let d3dx = "" as any;
	try {
		info("[IMM] Reading d3dx_user.ini...", await exists(d3dx_path));
		const backupPath = join(...tgt.split(/[/\\]/).slice(0, -1), `d3dx_user_pre_imm.ini.bak`);
		if (!(await exists(backupPath))) {
			await copyFile(d3dx_path, backupPath);
		}
		if (modifyIni) d3dx = await readTextFile(d3dx_path);
	} catch {
		info("[IMM] d3dx_user.ini not found or could not be read.");
	}

	try {
		const categories = [...store.get(CATEGORIES), { _sName: UNCATEGORIZED }].map((cat) => cat._sName);

		const reqCategories: Record<string, Array<{ name: string; isDirectory: boolean }>> = {};
		const entries = await readDir(src);
		const ignore = [IGNORE, managedSRC, managedTGT, RESTORE, PREFS];
		let fullDirectoryRenames: string[] = []; // First pass: categorize items
		for (const item of entries) {
			if (item.isDirectory && ignore.includes(item.name)) continue;
			if (item.name === OLD_RESTORE) {
				if (modifyIni) continue;
				try {
					await rename(join(src, OLD_RESTORE), join(src, RESTORE));
				} catch (error) {
					//console.error("Error renaming OLD_RESTORE:", error);
				}
				continue;
			}
			if (categories.includes(item.name)) {
				fullDirectoryRenames.push(item.name);
				continue;
			}
			const category = catDB?.search(item.name, { prefix: true, fuzzy: 0.2 })[0]?._sName || UNCATEGORIZED;
			// categories.find((cat: string) =>
			// 	cat
			// 		.toLowerCase()
			// 		.split(" ")
			// 		.some(
			// 			(catPart: string) =>
			// 				catPart.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(catPart)
			// 		)
			// ) || UNCATEGORIZED;
			if (item.isDirectory && item.name === category) {
				fullDirectoryRenames.push(category);
				continue;
			}

			if (!reqCategories[category]) {
				reqCategories[category] = [];
			}
			reqCategories[category].push({ name: item.name, isDirectory: item.isDirectory });
		}
		// Second pass: batch create directories and move items
		const mkdirPromises: Promise<void>[] = [];
		for (const key of Object.keys(reqCategories)) {
			mkdirPromises.push(mkdir(join(src, key), { recursive: true }));
		}
		await Promise.all(mkdirPromises);

		// Move items to categories
		const renamePromises: Promise<void>[] = [];
		const changesToD3dx: Record<string, string> = {};
		async function renameWithTry(key: string, name: string) {
			try {
				await rename(join(src, name), join(src, key, name));
				const oldPath = join(src, name);
				const newPath = join(src, key, name);
				info("[IMM] Renamed:", oldPath, "->", newPath);
				changesToD3dx[oldPath] = join(tgt, key, name);
			} catch (error) {
				warn("Error renaming:", key, "/", name, error);
			}
			return;
		}
		(await Promise.all(fullDirectoryRenames.map((dir) => readDirRecr(src, dir, 0)))).flat().forEach((entry: any) => {
			const oldPath = join(src, entry.path);
			const newPath = join(tgt, entry.path);
			changesToD3dx[oldPath] = newPath;
		});

		for (const [key, list] of Object.entries(reqCategories)) {
			for (const item of list) {
				renamePromises.push(renameWithTry(key, item.name));
			}
		}
		await Promise.all(renamePromises);
		if (modifyIni && d3dx) {
			d3dx = d3dx.split("\n");
			for (const [oldPath, newPath] of Object.entries(changesToD3dx)) {
				const op = iniPath("$\\mods", oldPath.replaceAll(tgt, "").replace(/[/\\]+/g, "\\")).toLowerCase();
				const np = iniPath(
					"$\\mods",
					managedTGT,
					replaceDisabled(newPath)
						.replaceAll(tgt, "")
						.replace(/[/\\]+/g, "\\")
				).toLowerCase();
				info("[IMM] Updating d3dx_user.ini:", op, "->", np);
				d3dx = d3dx.map((line: string) => (line.startsWith(op) ? line.replace(op, np) : line));
			}
			await writeTextFile(d3dx_path, d3dx.join("\n"));
		}
	} catch (error) {
		//console.error("Error categorizing directory:", error);
		throw error;
	}
}
export async function verifyDirStruct() {
	const status: ChangeInfo = {
		before: [],
		after: [],
		map: {},
		title: "Confirm Changes",
		skip: false,
	};
	try {
		if (!(!!src && (await exists(src))) || !(!!tgt && (await exists(tgt))))
			throw new Error("Source or Target not found: " + src + " | " + tgt);

		if (!(await exists(tgt))) throw new Error("Target Directory not found: " + tgt);
		try {
			const oldTgtPath = join(tgt, OLD_managedTGT);
			const newTgtPath = join(tgt, managedTGT);
			if (await exists(oldTgtPath)) {
				await rename(oldTgtPath, newTgtPath);
				//add code to read the file d3dx_user.ini in the parent folder of oldTgtPath, and replace all instances of OLD_managedTGT with managedTGT
				const parentDir = join(...tgt.split(/[/\\]/).slice(0, -1));
				const iniFilePath = join(parentDir, "d3dx_user.ini");
				info("[IMM] Updating d3dx_user.ini at:", iniFilePath);

				try {
					if (await exists(iniFilePath)) {
						let iniContent = await readTextFile(iniFilePath);
						const updatedContent = iniContent.split(OLD_managedTGT.toLowerCase()).join(managedTGT.toLowerCase());
						await writeTextFile(iniFilePath, updatedContent);
					}
				} catch (e) {
					error("Error updating d3dx_user.ini:", e);
				}
			}
			const oldSrcPath = join(src, OLD_managedSRC);
			const newSrcPath = join(src, managedSRC);
			if (await exists(oldSrcPath)) {
				await rename(oldSrcPath, newSrcPath);
				const targetEntries = (await readDirRecr(newTgtPath, "", 2)).flatMap((x) => x.children || []);
				info("[IMM] Fixing symlinks in target directory. Broken: ", targetEntries);
				for (const entry of targetEntries) {
					const linkPath = join(newTgtPath, entry.path);
					await remove(linkPath);
					await mkdir(join(newTgtPath, entry.parent), { recursive: true });
					try {
						await invoke("create_symlink", {
							linkPath: toFs(linkPath),
							targetPath: toFs(join(newSrcPath, entry.path)),
						});
						info("[IMM] Fixed symlink:", linkPath, "->", join(newSrcPath, entry.path));
					} catch (err) {
						error("[IMM] Error creating symlink:", err);
					}
				}
			}
		} catch (e: any) {
			if (e.startsWith("failed to rename old path")) {
				store.set(ERR, textData["v2.1.2Warning"]);
			} else {
				store.set(ERR, e.toString());
			}
		}
		const modDir = join(src, managedSRC);
		const [modDirExists, isOldVersion] = await Promise.all([exists(modDir), checkOldVerDirs(src)]);

		if (modDirExists) {
			await categorizeDir(modDir);
			status.skip = true;
		}
		if (isOldVersion) {
			await applyChanges(true);
			status.skip = true;
		}
		if (status.skip) throw new Error("Migration done, please verify the directories again");
		// const categories: Category[] = [
		// 	...store.get(CATEGORIES),
		// 	{ _sName: UNCATEGORIZED, _sIconUrl: "", _idRow: 0, _nItemCount: 0, _nCategoryCount: 0, _sUrl: "" },
		// ];
		const reqCategories: Record<string, DirEntry> = {};

		const srcEntries = await readDir(src);
		if (srcEntries.length === 0) {
			status.skip = true;
			await mkdir(modDir, { recursive: true });
			throw new Error("Source directory is empty");
		}
		status.before = srcEntries
			.map((item) => ({
				name: item.name,
				isDirectory: item.isDirectory,
				children: [],
			}))
			.sort(sortMods)
			.filter((item) => item.name !== IGNORE || !item.isDirectory);

		const before = [...status.before].filter(
			(item) => item.isDirectory && item.name !== IGNORE && item.name !== managedTGT && item.name !== managedSRC
		);
		status.after = [
			{
				name: managedSRC,
				isDirectory: true,
				children: [],
			},
		];

		// Batch read directories for items that need it
		const readPromises: Promise<{ item: any; entries: any[] }>[] = [];
		for (const item of before) {
			console.log("Processing item:", item.name, catDB?.search(item.name, { prefix: true, fuzzy: 0.2 }));
			const category =
				catDB?.search(item.name, { prefix: true, fuzzy: 0.2 })[0] ||
				(item.name === RESTORE || item.name === OLD_RESTORE
					? { _sName: RESTORE, _sIconUrl: "" }
					: { _sName: UNCATEGORIZED, _sIconUrl: "" });

			if ((item.isDirectory && item.name === category._sName) || item.name === OLD_RESTORE) {
				readPromises.push(
					readDir(join(src, item.name))
						.then((entries) => ({ item, entries, category }))
						.catch(() => {
							//console.error(`Error reading directory ${item.name}:`, error);
							return { item, entries: [], category };
						})
				);
			} else {
				// Add item directly without reading
				if (!reqCategories[category._sName]) {
					reqCategories[category._sName] = {
						name: category._sName,
						icon: category._sIconUrl,
						isDirectory: true,
						children: [],
					};
				}
				reqCategories[category._sName].children?.push({ name: item.name, isDirectory: item.isDirectory });
			}
		}

		// Process all read operations in parallel
		const readResults = await Promise.all(readPromises);
		for (const { entries, category } of readResults as any) {
			if (!reqCategories[category._sName]) {
				reqCategories[category._sName] = {
					name: category._sName,
					icon: category._sIconUrl,
					isDirectory: true,
					children: [],
				};
			}
			reqCategories[category._sName].children?.push(
				...entries.map((i: DirEntry) => ({ name: i.name, isDirectory: i.isDirectory }))
			);
		}
		status.map = { ...reqCategories };
		status.skip = Object.keys(reqCategories).length === 0;
		if (status.skip) throw new Error("No categories found, please verify the directories again");

		// Process modDir if it exists
		if (modDirExists) {
			try {
				const modDirEntries = await readDir(modDir);
				const modDirReadPromises: Promise<{ category: any; entries: DirEntry[] }>[] = [];

				for (const item of modDirEntries) {
					if (!item.isDirectory) continue;

					const category =
						item.name === RESTORE
							? { _sName: RESTORE, _sIconUrl: "" }
							: catDB?.search(item.name, { prefix: true, fuzzy: 0.2 })[0] || { _sName: UNCATEGORIZED, _sIconUrl: "" };

					if (category) {
						modDirReadPromises.push(
							readDir(join(modDir, item.name))
								.then((entries) => ({ category, entries }))
								.catch(() => {
									//console.error(`Error reading modDir category ${item.name}:`, error);
									return { category, entries: [] };
								})
						);
					}
				}

				const modDirResults = await Promise.all(modDirReadPromises);
				for (const { category, entries } of modDirResults) {
					if (!reqCategories[category._sName]) {
						reqCategories[category._sName] = {
							name: category._sName,
							icon: category._sIconUrl || "",
							isDirectory: true,
							children: [],
						};
					}
					reqCategories[category._sName].children?.push(
						...entries.map((i) => ({ name: i.name, isDirectory: i.isDirectory }))
					);
				}
			} catch (error) {
				//console.error("Error processing modDir:", error);
			}
		}
		for (const key of Object.keys(reqCategories)) {
			status.after[0].children?.push({
				...reqCategories[key],
				children: (reqCategories[key].children as DirEntry[]).sort(sortMods),
			});
		}
		status.after[0].children?.sort(sortMods);
		status.after.sort(sortMods);
	} catch (e) {
		info("[ERR] ", e);
	} finally {
		info("[IMM] Directory structure verified:", status);
		return status;
	}
}
export async function createManagedDir() {
	info("[IMM] Creating managed directories...");
	try {
		if (!src) return false;
		await mkdir(join(src, managedSRC), { recursive: true });
		if (!tgt) return false;
		await mkdir(join(tgt, managedTGT), { recursive: true });
		return true;
	} catch (err) {
		error("[IMM] Error creating managed directories:", err);
		throw err;
	}
}
export async function applyChanges(isMigration = false) {
	info("[IMM] Applying changes, isMigration:", isMigration);
	try {
		if (!src || !tgt) return false;

		let map: Record<string, DirEntry> = {};
		info("[IMM] Verifying directory structure before applying changes...");
		const target = join(tgt, managedTGT);
		if (!target) return true;
		info("[IMM] Target exists, creating managed directories...");
		await mkdir(join(src, managedSRC), { recursive: true });
		await mkdir(join(tgt, managedTGT), { recursive: true });
		console.log("[IMM] Managed directories created. Processing source directory...");
		await categorizeDir(src, true);

		const entries = true ? (await readDir(src)).map((item) => item.name) : Object.keys(map);

		info("[IMM] Processing entries:", entries);
		// Batch process entries
		for (const key of entries) {
			if (key === IGNORE || key === managedSRC || key === managedTGT || key === PREFS) continue;

			if (key === RESTORE || key === OLD_RESTORE) {
				try {
					await rename(join(src, OLD_RESTORE), join(src, managedSRC, RESTORE));
				} catch (e) {
					try {
						await copyDir(join(src, RESTORE), join(src, managedSRC, RESTORE));
					} catch (e) {
						//console.error(`Error handling RESTORE directory:`, e);
					}
				}
				continue;
			}

			try {
				info(`[IMM] Renaming ${key} to managedSRC...`);
				await rename(join(src, key), join(src, managedSRC, key));
			} catch (err) {
				error(`Error renaming ${key}:`, err);
				continue;
			}

			await mkdir(join(target, key), { recursive: true });

			const dirEntries = (true ? await readDir(join(src, managedSRC, key)) : map[key].children) || [];
			// Batch process directory entries
			const itemOperations: Promise<void>[] = [];
			for (const item of dirEntries) {
				const isDisabled = item.name.startsWith("DISABLED");
				const name = replaceDisabled(item.name);
				if (isDisabled) {
					itemOperations.push(
						rename(join(src, managedSRC, key, item.name), join(src, managedSRC, key, name)).catch(() => {
							//console.error(`Error renaming disabled item ${item.name}:`, error);
						})
					);
				} else {
					itemOperations.push(
						invoke<void>("create_symlink", {
							linkPath: toFs(join(target, key, name)),
							targetPath: toFs(join(src, managedSRC, key, name)),
						}).catch(() => {
							//console.error(`Error creating symlink for ${name}:`, error);
						}) as Promise<void>
					);
				}
			}
			await Promise.all(itemOperations);
		}
		return true;
	} catch (err) {
		error("[IMM] Error applying changes:", err);
		throw err;
	}
}
async function readDirRecr(
	root: string,
	path: string,
	maxDepth = 2,
	depth = 0,
	cached = false,
	backupMode = false
): Promise<Mod[]> {
	if (depth > maxDepth) return [];
	let entries: DirEntry[] = [];
	try {
		entries = await readDir(join(root, path));
	} catch {
		return [];
	}
	if (cached && depth == 2 && entries.find((entry) => entry.name == ".imm-cache.json")) return [];
	const filePromises = entries.map(async (entry) => {
		if ((entry.name == RESTORE || entry.name == IGNORE || entry.name == PREFS) && cached && depth == 0) return null;
		let children: Mod[] = [];
		if (entry.isDirectory && (!backupMode || (entry.name !== INI_BACKUP && !entry.name.startsWith(".imm"))))
			children = await readDirRecr(root, join(path, entry.name), maxDepth, depth + 1, cached, backupMode);
		return {
			isDir: entry.isDirectory,
			name: entry.name,
			parent: join(path),
			path: join(path, entry.name),
			keys: [],
			enabled: false,
			children,
			depth,
			maxed: maxDepth == 9,
		};
	});
	const files = (await Promise.all(filePromises)).filter((file) => file !== null) as Mod[];
	return files.sort(sortMods);
}
export async function remSaveModData() {
	const modSrc = join(src, managedSRC);
	const entries = (await readDirRecr(modSrc, "", 1))
		.map((entry) => entry.children || [])
		.flat()
		.filter((child) => child.isDir);
	const data = store.get(DATA) || {};
	const promises = entries.map(async (entry) => {
		const modPath = join(modSrc, entry.path, "mod.json");

		if (data[entry.path]) {
			const modData = data[entry.path];
			delete modData.viewedAt;
			delete modData.updatedAt;
			await writeTextFile(modPath, JSON.stringify(modData, null, 2));
		}
	});
	await Promise.all(promises);
}
export async function remSavePresets() {
	const presets = store.get(PRESETS) || {};
	const presetFolder = join(tgt, "Presets");
	await mkdir(presetFolder, { recursive: true });
	const promises = presets.map(async (preset) => {
		const presetPath = join(presetFolder, `${preset.name}.txt`);
		await writeTextFile(presetPath, preset.data.join("\n"));
	});
	await Promise.all(promises);
}
export async function remMoveMods(categoryMode = true, enable = 0) {
	const allEntries = await readDirRecr(join(src, managedSRC), "", 1);
	const categories = allEntries
		.filter((entry) => entry.isDir && entry.children && entry.children.length > 0)
		.map((entry) => entry.name);
	if (categoryMode) {
		const categoryPromises = categories.map(async (category) => mkdir(join(tgt, category), { recursive: true }));
		await Promise.all(categoryPromises);
	}
	const entries = allEntries.map((entry) => entry.children || []).flat();
	const enabled = new Set(enable == 1 ? entries.map((entry) => entry.path) : []) as Set<string>;
	if (enable == 0) {
		const existsPromises = entries.map(async (entry) => {
			const targetPath = join(tgt, managedTGT, entry.path);
			if (await exists(targetPath)) {
				enabled.add(entry.path);
			}
		});
		await Promise.all(existsPromises);
	}
	const iniChanges: Record<string, string> = {};
	const movePromises = entries.map(async (entry) => {
		const srcPath = join(src, managedSRC, entry.path);
		const tgtPath = join(
			`${categoryMode ? entry.parent + "/" : ""}${enabled.has(entry.path) ? "" : "DISABLED "}${entry.name}`
		);
		let finalTgt = tgtPath;
		let counter = 1;
		while (await exists(finalTgt)) {
			finalTgt = tgtPath + `_${counter}`;
			counter++;
		}
		await rename(srcPath, join(tgt, finalTgt));
		if (enabled.has(entry.path)) {
			iniChanges[iniPath("$\\mods", managedTGT, entry.path).toLowerCase()] = iniPath("$\\mods", finalTgt).toLowerCase();
		}
	});
	await Promise.all(movePromises);
	// console.log("All entries moved. Updating d3dx_user.ini if needed...", iniChanges);
	const d3dxPath = join(...tgt.split(/[/\\]/).slice(0, -1), "d3dx_user.ini");
	try {
		if (await exists(d3dxPath)) {
			let d3dx = await readTextFile(d3dxPath);
			for (const [oldPath, newPath] of Object.entries(iniChanges)) {
				d3dx = d3dx.split(oldPath).join(newPath);
			}
			await writeTextFile(d3dxPath, d3dx);
		}
	} catch (e) {
		error("Error updating d3dx_user.ini:", e);
	}
	try {
		await remove(join(tgt, managedTGT), { recursive: true });
	} catch {}
	const removeSrcPromises = allEntries.map(async (entry) => {
		try {
			await remove(join(src, managedSRC, entry.path));
		} catch {}
	});
	await Promise.all(removeSrcPromises);
	try {
		await remove(join(src, managedSRC, RESTORE));
	} catch {}
	try {
		await remove(join(src, managedSRC, PREFS));
	} catch {}
	try {
		await remove(join(src, managedSRC));
	} catch {}
}
async function detectHotkeys(
	entries: Mod[],
	data: ModDataObj,
	src: string,
	depth = 0,
	cache = 1 // 0 = no cache, 1 = use cache, 2 = write cache, 3 = use and write cache
): Promise<[Mod[], any, ModHotKeys[], Set<string>]> {
	let namespaces = new Set<string>();
	const entryPromises = entries.map(async (entry) => {
		let hkData: ModHotKeys[] = [];
		let hashes = new Set() as any;
		try {
			let cacheUsed = false;

			// // Apply stored data to entry
			const modData = getModData(data, entry.path);
			if (modData) {
				entry = { ...entry, ...modData } as Mod;
			}
			// Parse .ini files for hotkeys
			if (entry.name.endsWith(".ini")) {
				try {
					const file = await readTextFile(join(src, entry.path));
					const lines = file.split("\n");
					let counter = 0;
					let key = "";
					let type = "";
					let target = "";
					let values = "";
					let tempKey = "";
					let tempVal = "";
					let section = "";
					let namespace = "";
					let globalVars: Record<string, ModHotKeys> = {};
					let fileData: Record<string, ModHotKeys> = {};
					for (let line of lines) {
						let ln = line
							.trim()
							.replaceAll(/[\r\n]+/g, "")
							.replaceAll(" ", "")
							.toLowerCase();
						if (ln.startsWith("[") && ln.endsWith("]")) {
							section = ln.slice(1, -1).toLowerCase();
						}
						if (ln.startsWith("namespace=")) {
							namespace = ln.split("=")[1]?.trim().toLowerCase() || "";
							namespaces.add(namespace);
							entry.namespace = namespace;
							continue;
						}
						if (section === "constants" && ln.includes("global")) {
							const afterGlobal = ln.split("global")[1];
							if (!afterGlobal.includes("$")) continue;
							const afterDlr = afterGlobal.split("$")[1];
							if (!afterDlr.includes("=")) continue;
							try {
								[tempKey, tempVal] = ln
									.split("$")[1]
									.split("=")
									.map((part) => part.trim());
								if (fileData.hasOwnProperty(tempKey)) {
									fileData[tempKey].default = tempVal;
								} else if (!globalVars.hasOwnProperty(tempKey))
									globalVars[tempKey] = {
										target: tempKey,
										file: entry.path.split(/[/\\]/).slice(2).join("\\").toLowerCase(),
										namespace,
										name: tempKey,
										default: tempVal,
										pref: null,
										reset: null,
										key: "",
										type: "",
										values: ["unknown"],
									};
							} catch {}
						}
						if (ln.startsWith("hash=")) {
							const val = line.split("=")[1]?.trim() || "";
							hashes.add(val);
						}
						if (counter === 0 && ln.startsWith("key=")) {
							key = line.split("=")[1]?.trim();
							counter++;
						} else if (counter === 1 && ln.startsWith("type=")) {
							type = line.split("=")[1]?.trim() || "";
							counter++;
						} else if (counter === 2 && ln.startsWith("$")) {
							[target, values] = line.split("=").map((part) => part.trim());
							target = target?.slice(1) || "";
							counter = 0;
							if (!fileData.hasOwnProperty(target))
								fileData[target] = {
									...(globalVars[target] || {
										target,
										file: entry.path.split(/[/\\]/).slice(2).join("\\").toLowerCase(),
										name: target,
										namespace,
										default: "",
										pref: null,
										reset: null,
									}),
									key,
									type,
									values:
										values
											.split(",")
											.map((v) => v.trim())
											.filter((v) => v) || "",
								};
							delete globalVars[target];
						}
					}

					hkData.push(...Object.values(fileData), ...Object.values(globalVars));
				} catch (iniError) {
					console.log("Error reading/parsing ini file:", join(src, entry.path), iniError);
				}
			}
			if (entry.isDir && entry.children.length > 0 && entry.name !== INI_BACKUP) {
				try {
					if (depth == 1 && cache % 2 == 1 && (await exists(join(src, entry.path, ".imm-cache.json")))) {
						cacheUsed = true;
						entry = {
							...entry,
							...JSON.parse(await readTextFile(join(src, entry.path, ".imm-cache.json"))),
							...modData,
							path: entry.path,
							parent: entry.parent,
							name: entry.name,
							isDir: entry.isDir,
						};
						hkData = entry.keys || hkData;
						hashes = new Set(entry.hashes || []);
						namespaces = new Set(entry.namespaces || []);
						console.log("[IMM] Cache used for:", entry.path);
					} else {
						throw new Error("Not depth 1");
					}
				} catch {
					cacheUsed = false;
					const [updatedChildren, childHashes, childHK, newNamespaces] = await detectHotkeys(
						entry.children,
						data,
						src,
						depth + 1,
						cache
					);
					hashes = new Set([...Array.from(hashes), ...Array.from(childHashes)]);
					entry.children = updatedChildren;
					if (childHK.length > 0 && depth > 0) {
						hkData = [...hkData, ...childHK];
					}
					if (depth == 1 && cache > 1 && !cacheUsed) {
						await writeTextFile(
							join(src, entry.path, ".imm-cache.json"),
							JSON.stringify(
								{ ...entry, keys: hkData, hashes: Array.from(hashes), namespaces: Array.from(namespaces) },
								null,
								2
							)
						);
					}
					namespaces = new Set([...Array.from(namespaces), ...Array.from(newNamespaces)]);
				}
			}
			if (depth == 1) {
				entry.keys = hkData;
				entry.hashes = Array.from(hashes);
				entry.namespaces = namespaces;
			}
		} catch (entryError) {}
		return { entry, hkData, hashes, namespaces };
	});

	const results = await Promise.all(entryPromises);
	const processedEntries = results.map((r) => r.entry);
	const hotkeyData = depth < 2 ? [] : results.flatMap((r) => r.hkData);
	const hashes = new Set<string>(results.flatMap((r) => Array.from(r.hashes)));
	return [processedEntries, hashes, hotkeyData, namespaces];
}
export async function getModDetails(relPath: string, data?: ModDataObj) {
	delete data?.children;
	const [category, modName] = relPath.split(/[/\\]/);
	const modSrc = join(src, managedSRC);
	try {
		const entries = await readDirRecr(modSrc, relPath, 9);
		const new_entries = (
			await detectHotkeys(
				[
					{
						name: category,
						isDir: true,
						parent: "",
						path: category,
						keys: [],
						enabled: false,
						children: [
							{
								name: modName,
								isDir: true,
								parent: category,
								path: relPath,
								keys: [],
								enabled: false,
								children: entries,
								depth: 1,
								hashes: [],
								maxed: true,
							},
						],
						depth: 0,
						hashes: [],
						maxed: true,
					},
				],
				data ? { [relPath]: data } : store.get(DATA),
				modSrc,
				0,
				2
			)
		)[0] as Mod[];
		const allVars = new_entries[0].children[0].keys || [];
		const namespaces = new_entries[0].children[0].namespaces || new Set<string>();
		const keys = allVars.filter((v) => v.key);
		const files = {} as Record<string, ModHotKeys[]>;
		for (const varData of allVars) {
			if (!files[varData.file]) files[varData.file] = [];
			files[varData.file].push(varData);
		}
		Object.keys(files).forEach((file) => {
			files[file] = files[file].sort((a, b) => a.target.localeCompare(b.target));
		});
		return { keys, files, namespaces };
	} catch (error) {
		return { keys: [], files: {}, namespaces: new Set<string>() };
	}
}
let deepRefreshId = 0;
export async function refreshModList(maxed = false) {
	info("[IMM] Refreshing mod list...");
	let before = Date.now();
	let curId = deepRefreshId;
	if (maxed) {
		curId = ++deepRefreshId;
	}
	try {
		const data = store.get(DATA);
		const modSrc = join(src, managedSRC);
		const modTgt = join(tgt, managedTGT);
		let categories = new Set([...store.get(CATEGORIES), { _sName: UNCATEGORIZED }].map((cat) => cat._sName));
		for (let attempts = 0; categories.size < 10 && attempts < 20; attempts++) {
			await new Promise((res) => setTimeout(res, 100));
			categories = new Set([...store.get(CATEGORIES), { _sName: UNCATEGORIZED }].map((cat) => cat._sName));
		}
		if (!maxed) await categorizeDir(modSrc);
		if (curId !== deepRefreshId && maxed) return [];
		const ret = await detectHotkeys(await readDirRecr(modSrc, "", 9, 0, true), data, modSrc, 0, maxed ? 3 : 1);
		console.log(
			"[IMM] Mod list refresh complete. Entries:",
			ret[0].length,
			"Hashes:",
			ret[1].size,
			"Hotkeys:",
			ret[2].length
		);
		if (curId !== deepRefreshId && maxed) return [];

		let hasErr = "";
		const entries = (
			ret[0]
				.map((entry) =>
					categories.has(entry.name)
						? entry.children
						: (() => {
								hasErr = entry.name;
								return null;
							})()
				)
				.flat()
				.map((entry) => {
					if (entry && entry.depth == 1) entry.children = [];
					if (entry) {
						const allVars = entry.keys || [];
						const keys = allVars.filter((v) => v.key);
						const files = {} as Record<string, ModHotKeys[]>;
						for (const varData of allVars) {
							if (!files[varData.file]) files[varData.file] = [];
							files[varData.file].push(varData);
						}
						entry.keys = keys;
						entry.files = files;
					}
					return entry;
				})
				.filter((entry) => entry !== null && entry.depth < 2 && entry.name != ".imm-collision-checklist") as Mod[]
		).sort(sortMods);

		if (hasErr && !maxed) {
			addToast({ type: "error", message: textData._Toasts.UnableCat.replace("<item/>", hasErr) });
		}

		// Batch process entries - separate rename operations from exists checks
		const renameOperations: Promise<void>[] = [];
		const existsChecks: Promise<{ entry: Mod; enabled: boolean }>[] = [];
		if (curId !== deepRefreshId && maxed) return [];

		for (const entry of entries) {
			if (entry.name.startsWith("DISABLED")) {
				const newName = replaceDisabled(entry.name);
				const newPath = join(entry.parent, newName);

				renameOperations.push(
					rename(join(modSrc, entry.path), join(modSrc, newPath))
						.then(() => {
							entry.name = newName;
							entry.path = newPath;
						})
						.catch(() => {
							//console.error(`Error renaming ${entry.name}:`, error);
						})
				);
			}
			existsChecks.push(
				exists(join(modTgt, entry.path))
					.then((enabled) => ({ entry, enabled }))
					.catch(() => ({ entry, enabled: false }))
			);
		}

		// Wait for all renames to complete first
		await Promise.all(renameOperations);

		// Then process exists checks
		const existsResults = await Promise.all(existsChecks);

		for (const { entry, enabled } of existsResults) {
			entry.enabled = enabled;
			// if(enabled)
			// entry.enabledAt = now;
		}
		if (maxed) {
			info(
				"[IMM] Mod list deep refreshed:",
				entries.map((e) => ({ path: e.path, enabled: e.enabled }))
			);
			info("[IMM] Mod list deep refresh took", Date.now() - before, "ms");
			store.set(
				MOD_LIST,
				entries
					.filter((entry) => recentlyDownloaded.includes(entry.path))
					.concat(entries.filter((entry) => !recentlyDownloaded.includes(entry.path)))
			);
			return entries
				.filter((entry) => recentlyDownloaded.includes(entry.path))
				.concat(entries.filter((entry) => !recentlyDownloaded.includes(entry.path)));
		}
		info(
			"[IMM] Mod list refreshed:",
			entries.map((e) => ({ path: e.path, enabled: e.enabled }))
		);
		info("[IMM] Mod list refresh took", Date.now() - before, "ms");
		return entries
			.filter((entry) => recentlyDownloaded.includes(entry.path))
			.concat(entries.filter((entry) => !recentlyDownloaded.includes(entry.path)));
	} catch (err) {
		error("[IMM] Error refreshing mod list:", err);
		throw err;
	}
}
async function backupIniFiles(cat: string, mod: string, key: string, relPath = "") {
	//EDIT AFTER MERGE
	const entries = await readDir(join(modRoot, cat, mod, relPath));
	try {
		for (const entry of entries) {
			if (entry.name === INI_BACKUP) continue;
			const entryRelPath = join(relPath, entry.name);
			if (entry.isDirectory) {
				await backupIniFiles(cat, mod, key, entryRelPath);
			} else if (entry.name.toLowerCase().endsWith(".ini")) {
				await mkdir(join(modRoot, cat, mod, INI_BACKUP, key, relPath), { recursive: true });
				await copyFile(join(modRoot, cat, mod, entryRelPath), join(modRoot, cat, mod, INI_BACKUP, key, entryRelPath));
			}
		}
	} catch (err) {
		error("[IMM] Error backing up .ini files:", err);
	}
}
export async function createModDownloadDir(cat: string, dir: string) {
	try {
		if (!cat || !dir) return;
		const path = join(src, managedSRC, cat, dir);
		if (await exists(path)) {
			if (store.get(BACKUP_INI)) {
				await backupIniFiles(cat, dir, "Update-" + new Date().toISOString().replace(/[:.]/g, "_"));
			}
			return path;
		}
		await mkdir(path, { recursive: true });
		return path;
	} catch (err) {
		error("[IMM] Error creating mod download directory:", err);
		throw err;
	}
}
export async function validateModDownload(path: string, skip = false, addModSrc = false) {
	if (addModSrc && !path.startsWith(join(src, managedSRC))) {
		path = join(src, managedSRC, path);
	}
	console.log("[IMM] Validating mod download for path:", path);
	let count = 0;
	try {
		let entries: DirEntry[] = [];
		async function validator() {
			entries = (await readDir(path)).filter(
				(entry) => entry.name.toUpperCase() !== INI_BACKUP && !entry.name.toLowerCase().startsWith(".imm")
			);
			const dirs = entries.filter((entry) => entry.isDirectory);
			if (dirs.length > 1 || dirs.length === 0) return false;
			const txtCount = entries.filter((entry) => entry.name.endsWith(".txt") && !entry.isDirectory).length;
			const imgCount = entries.filter((entry: any) => {
				const ext = entry.name.split(".").slice(-1)[0].toLowerCase();
				return exts.includes(ext) && !entry.isDirectory;
			}).length;
			return entries.length - txtCount - imgCount === 1;
		}
		while (await validator()) {
			let hasIni = false;
			const dirs: string[] = [];

			for (const entry of entries) {
				if (entry.name.endsWith(".ini")) hasIni = true;
				if (entry.isDirectory) dirs.push(entry.name);
			}

			if (!hasIni && dirs.length === 1) {
				const uuid = "IMM_TEMP_" + Math.floor(Math.random() * 1000000000);
				const tempPath = path + "/" + uuid;
				const dirPath = path + "/" + dirs[0];

				try {
					await rename(dirPath, tempPath);
					await copyDir(tempPath, path);
					await remove(tempPath, { recursive: true });
				} catch (err) {
					error("[IMM] Error flattening mod directory structure:", err);
				}
			}
			count++;
		}
		if (!skip) {
			const relPath = path.split(new RegExp(managedSRC.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[/\\\\]"))[1];
			info("[IMM] Validating mod download for path:", relPath)
			const keys = JSON.parse(sessionStorage.getItem("modData_" + relPath) || "[]") as any[];
			if (keys) {
				const files = {} as Record<string, Record<string, { def?: string, hk?:string }>>;
				for (const hk of keys) {
					if (hk.default) {
						if (!files[hk.file]) files[hk.file] = {};
						files[hk.file][hk.target] = {
							def: hk.default,
						};
					}
					if (hk.key) {
						if (!files[hk.file]) files[hk.file] = {};
						files[hk.file][hk.target] = {
							...files[hk.file][hk.target],
							hk: hk.key,
						};
					}

				}
				const promises = [] as Promise<any>[];
				Object.keys(files).forEach((file) => {
					if (Object.keys(files[file]).length > 0) {
						promises.push(updateIniVars(join(relPath, file), files[file]));
					}
				});
				await Promise.all(promises);
			}
			const downloads = store.get(DOWNLOAD_LIST);
			const completed = downloads.completed.length + 1;
			const total = completed + downloads.queue.length;
			addToast({ type: "success", message: `${textData._Toasts.DownloadComplete} (${completed}/${total})` });
		}
		
	} catch (err) {
		if (!skip) addToast({ type: "error", message: textData._Toasts.ErrDownload });
		error("[IMM] Error validating mod download:", err);
	}
	return count;
}
export async function cleanCancelledDownload(path: string) {
	try {
		if (!(await exists(path))) return;
		const entries = await readDir(path);
		const hasPreview = entries.filter((entry) => entry.name.startsWith("preview.") && !entry.isDirectory).length;
		const hasArchive = entries.filter(
			(entry) => entry.name.endsWith(".zip") || entry.name.endsWith(".rar") || entry.name.endsWith(".7z")
		).length;
		if (entries.length === hasPreview + hasArchive && hasArchive <= 1 && hasPreview <= 1) {
			await remove(path, { recursive: true });
		}
	} catch (err) {
		error("[IMM] Error cleaning cancelled download:", err);
	}
}
export async function changeModName(path: string, newPath: string, add = false) {
	try {
		const enabled = add || (await toggleMod(path, false, false, "system"));
		await mkdir(join(src, managedSRC, ...newPath.split(/[/\\]/).slice(0, -1)), { recursive: true });
		await rename(add ? join(src, path) : join(src, managedSRC, path), join(src, managedSRC, newPath));
		store.set(DATA, (prev) => {
			if (!prev[path]) return prev;
			const { [path]: oldData, ...rest } = prev;
			return { ...rest, [newPath]: { ...oldData } };
		});
		store.set(PRESETS, (prev) => {
			return prev.map((preset) =>
				preset.data.includes(path)
					? { ...preset, data: [...preset.data.filter((presetPath) => presetPath !== path), newPath] }
					: preset
			);
		});
		saveConfigs();
		console.log("Mod name changed from", path, "to", newPath);
		await updatePrefsIniFromData(newPath, path);
		if (enabled) await toggleMod(newPath, true, false, "system");
		await trackUserAction({ action: "mod_renamed", mod: newPath, details: { previousPath: path } });
		return newPath;
	} catch (err) {
		error("[IMM] Error changing mod name:", err);
		throw err;
	}
}
export async function deleteCategory(cat: string) {
	const path = join(src, managedSRC, cat);
	if (!(await exists(path))) return true;
	try {
		await remove(path);
		return true;
	} catch (err) {
		error("[IMM] Error deleting category:", err);
		return false;
	}
}
export async function deleteRestorePoint(point: string) {
	try {
		const path = join(modRoot, RESTORE, point);
		await remove(path, { recursive: true });
		addToast({ type: "success", message: textData._Toasts.Deleted });
		return true;
	} catch (err) {
		error("[IMM] Error deleting restore point:", err);
		addToast({ type: "error", message: textData._Toasts.ErrOcc });
		return false;
	}
}
export async function deleteMod(path: string) {
	const modSrc = join(src, managedSRC, path);
	const modTgt = join(tgt, managedTGT, path);

	try {
		await remove(modTgt);
	} catch (err) {
		error("[IMM] Error removing mod target:", err);
	}

	try {
		await remove(modSrc, { recursive: true });
		addToast({ type: "success", message: textData._Toasts.Deleted });
		await trackUserAction({ action: "mod_deleted", mod: path });
	} catch (err) {
		error("[IMM] Error removing mod source:", err);
		addToast({ type: "error", message: textData._Toasts.ErrOcc });
		throw error;
	}
}
async function updateDataFromD3DXIni(modPaths: string | string[]) {
	let mods = [] as string[];
	if (Array.isArray(modPaths)) {
		mods = modPaths;
	} else {
		mods = [modPaths];
	}
	const root = join(...tgt.split(/[/\\]/).slice(0, -1), "d3dx_user.ini");
	const lines = [] as string[];
	if (await exists(root)) {
		lines.push(
			...(await readTextFile(root))
				.toLowerCase()
				.split("\n")
				.map((line: string) => line.trim())
				.filter((line: string) => line && !line.startsWith(";") && line.includes("="))
		);
	}
	const data = store.get(DATA);
	let modified = false;
	for (let modPath of mods) {
		data[modPath] = data[modPath] || {};
		data[modPath].vars = data[modPath].vars || {};
		try {
			remove(join(tgt, managedTGT, PREFS, modPath + ".ini"));
		} catch {}
		const path = `mods\\${managedTGT}\\${modPath}\\`.toLowerCase();
		const namespaces = Array.from(modMap[modPath]?.namespaces || new Set()) as string[];
		for (let line of lines) {
			const namespaceMatch = namespaces.find((n) => line.includes(n)) || "";
			const mode = line.includes(path) ? 0 : namespaceMatch ? 1 : -1;
			if (mode == -1) continue;
			const lineKey = mode ? namespaceMatch : path;
			const [KeyVar, Val] = line
				.split("=")
				.map((part: string, i: number) => (i ? part.trim() : part.trim().split(lineKey)[1]));
			const Var = (mode ? KeyVar : KeyVar.split("\\").pop() || "").toLowerCase().trim();
			const Key = mode ? lineKey : KeyVar.split("\\").slice(0, -1).join("\\").toLowerCase().trim();
			if (Key && Var && Val) {
				if (!data[modPath].vars.hasOwnProperty(Key)) data[modPath].vars[Key] = {};
				if (!data[modPath].vars[Key].hasOwnProperty(Var)) data[modPath].vars[Key][Var] = {};
				data[modPath].vars[Key.trim()][Var.toLowerCase().trim()].state = Val.trim();
				modified = true;
			}
		}
	}
	if (modified) {
		store.set(DATA, (prev) => {
			prev = { ...prev };
			mods.forEach((modPath) => {
				if (Object.keys(data[modPath].vars || {}).length > 0) {
					prev[modPath] = {
						...prev[modPath],
						vars: data[modPath].vars,
					} as any;
				}
			});
			return prev;
		});
		saveConfigs();
	}
	info("[IMM] Updating data from ini for mod data:", data);
}
async function updatePrefsIniFromData(modPath: string, oldPath = "") {
	const data = store.get(DATA)[modPath];
	if (!data || !data.vars) return;
	const [category, name] = modPath.split(/[/\\]/);
	const dir = join(tgt, managedTGT, PREFS, category);
	await mkdir(dir, { recursive: true });
	const root = join(dir, `${name}.ini`);
	if (oldPath) {
		const oldRoot = join(tgt, managedTGT, PREFS, oldPath);
		if (!(await exists(oldRoot))) return;
		await writeTextFile(root, (await readTextFile(oldRoot)).split(oldPath.toLowerCase()).join(modPath.toLowerCase()));
		remove(oldRoot);
	} else {
		const lines = {} as Record<string, string>;
		for (let key of Object.keys(data.vars)) {
			for (let Var of Object.keys(data.vars[key])) {
				const x = data.vars[key][Var];
				const line =
					`$\\${key.endsWith(".ini") ? `mods\\${managedTGT}\\${modPath}\\` : ""}${key}\\${Var}`.toLowerCase();
				const value = x.pref ?? x.state;
				//lines[line] = x.pref ?? x.state;
				lines[line] = value === undefined || value === null ? "" : String(value);
				if (lines[line] === undefined || lines[line] === null || lines[line] === "") delete lines[line];
				else info(`[IMM] Updating Mod: ${modPath} | File: ${key} | Added Line: ${line}`);
			}
		}
		await writeTextFile(
			root,
			[
				";-- set by imm --",
				"[constants]",
				...Object.entries(lines).map(([key, value]) => `${key}=${value}`),
				";-- end imm --",
			].join("\n")
		);
	}
}

export async function updateIniVars(relPath: string, keyVals: Record<string, { def?: string; hk?: string }>) {
	const path = join(modRoot, relPath);
	console.log("Updating ini vars for:", relPath, "at", path, "with keyVals:", JSON.parse(JSON.stringify(keyVals)));
	const [category, modName, ...rest] = relPath.split("\\");
	const backupPath = join(modRoot, category, modName, INI_BACKUP, "default", ...rest);
	if (!(await exists(backupPath))) {
		await mkdir(join(...backupPath.split("\\").slice(0, -1)), { recursive: true });
		await copyFile(path, backupPath);
	}
	const file = await readTextFile(path);
	const lines = file.split("\n");
	try {
		let section = "";
		let keyLine = -1;
		let counter = 0;
		for (let i = 0; i < lines.length; i++) {
			let ln = lines[i]
				.trim()
				.replaceAll(/[\r\n]+/g, "")
				.replaceAll(" ", "")
				.toLowerCase();
			if (ln.startsWith("[") && ln.endsWith("]")) {
				section = ln.slice(1, -1).toLowerCase();
			}
			if (section === "constants" && ln.includes("$") && ln.includes("=")) {
				const modKey = ln.split("$")[1].split("=")[0].trim().toLowerCase();
				if (keyVals.hasOwnProperty(modKey) && keyVals[modKey].hasOwnProperty("def")) {
					lines[i] = `${lines[i].split("=")[0]}= ${keyVals[modKey].def}`;
					info(`[IMM] Updating Mod: ${path} | Line${i}: ${lines[i]}`);
				}
				if (Object.keys(keyVals).length === 0) break;
			}
			if (section !== "constants") {
				if (counter === 0 && ln.startsWith("key=")) {
					keyLine = i;
					console.log("yo")
					counter++;
				} else if (counter === 1 && ln.startsWith("type=")) {
					counter++;
				} else if (counter === 2 && ln.startsWith("$")) {
					let [target] = ln.split("=").map((part) => part.trim());
					target = target?.slice(1) || "";
					counter = 0;

					if (keyVals.hasOwnProperty(target) && keyVals[target].hasOwnProperty("hk")) {
						lines[keyLine] = `key = ${keyVals[target].hk}`;
					}
				}
			}
		}
	} catch {
		return false;
	}
	await writeTextFile(path, lines.join("\n"));
	return true;
}
export function openFile(relPath: string) {
	openPath(toFs(join(modRoot, relPath)));
}
export async function toggleMod(
	path: string,
	enabled: boolean,
	forced = false,
	source: "manual" | "preset" | "system" = "manual"
): Promise<boolean> {
	info("[IMM] Togglingx mod:", path, "Enabled:", enabled);
	try {
		const modSrc = join(src, managedSRC, path);
		const modTgt = join(tgt, managedTGT, path);

		if (enabled) {
			const [srcExists, tgtExists] = await Promise.all([exists(modSrc), exists(modTgt)]);
			if ((srcExists && !tgtExists) || forced) {
				await updatePrefsIniFromData(path);
				if (forced) return true;
				await mkdir(join(tgt, managedTGT, ...path.split(/[/\\]/).slice(0, -1)), { recursive: true });
				try {
					await invoke("create_symlink", {
						linkPath: toFs(modTgt),
						targetPath: toFs(modSrc),
					});
				} catch (err) {
					error("[IMM] Error creating symlink:", err);
					return false;
				}
			}
		} else {
			await updateDataFromD3DXIni(path);
			try {
				await remove(modTgt);
			} catch (err) {
				error("[IMM] Error removing mod:", err);
				return false;
			}
		}
	} catch (err) {
		error("[IMM] Error toggling mod:", err);
		return false;
	}
	console.log(`Success Mod ${enabled ? "enabled" : "disabled"}:`, path);
	if (!forced && source !== "system") {
		await trackUserAction({
			action: enabled ? "mod_enabled" : "mod_disabled",
			mod: path,
			details: { source },
		});
	}
	return true;
}
export async function savePreviewImageFromData(relPath: string, type: string, data: any) {
	const path = join(src, managedSRC, relPath);
	const previewPath = join(path, "preview." + type);
	console.log("Saving preview image for:", path, "at", previewPath);
	const removePromises = exts.map((ext) =>
		remove(path + "/" + "preview." + ext).catch(() => {
			// Ignore errors if file doesn't exist
		})
	);
	await Promise.all(removePromises);
	await writeFile(previewPath, data);
	store.set(LAST_UPDATED, Date.now());
	store.set(DATA, (prev) => {
		if (!prev[relPath]) return prev;
		const { crop, ...modData } = prev[relPath];
		return { ...prev, [relPath]: modData };
	});
	store.set(MOD_LIST, (prev) => {
		return prev.map((mod) => {
			if (mod.path === relPath) {
				const { crop, ...newMod } = mod;
				return newMod;
			}
			return mod;
		});
	});
	saveConfigs();

	addToast({ type: "success", message: textData._Toasts.ImgSaved });
}
export async function savePreviewImage(path: string) {
	try {
		path = join(src, managedSRC, path);
		const file = await open({
			multiple: false,
			directory: false,
			filters: [{ name: "Image", extensions: exts }],
		});

		if (!file) return false;

		// Remove existing preview images in parallel

		const removePromises = exts.map((ext) =>
			remove(path + "/" + "preview." + ext).catch(() => {
				// Ignore errors if file doesn't exist
			})
		);
		await Promise.all(removePromises);

		// Copy new preview image
		const fileExt = file.split(".").pop();
		await copyFile(file, path + "/" + "preview." + fileExt);
		store.set(LAST_UPDATED, Date.now());
		addToast({ type: "success", message: textData._Toasts.ImgSaved });
	} catch (err) {
		//console.error("Error saving preview image:", error);
		addToast({ type: "error", message: textData._Toasts.ErrOcc });
		return false;
		throw error;
	}
	return true;
}
export async function applyPreset(data: string[], name = "") {
	try {
		const entries = (await readDirRecr(join(tgt, managedTGT), "", 2)).flatMap((x) => x.children || []);
		const disablePromises: Promise<boolean>[] = entries.map((entry) => toggleMod(entry.path, false, false, "preset"));
		await Promise.all(disablePromises);
		await remove(join(tgt, managedTGT), { recursive: true });
		await mkdir(join(tgt, managedTGT), { recursive: true });

		// Apply mods in parallel batches to improve performance
		const batchSize = 10;
		for (let i = 0; i < data.length; i += batchSize) {
			const batch = data.slice(i, i + batchSize);
			await Promise.all(
				batch.map((mod) =>
					toggleMod(mod, true, false, "preset").catch((err = "unknown") => {
						error(`[IMM] Error toggling mod ${mod}:`, err);
					})
				)
			);
		}
		if (name) {
			addToast({ type: "success", message: textData._Toasts.PresetApplied });
			await trackUserAction({
				action: "preset_applied",
				preset: name,
				details: { enabledMods: data.length },
			});
		}
	} catch (err) {
		error("[IMM] Error applying preset:", err);
		if (name) addToast({ type: "error", message: textData._Toasts.ErrOcc });
		throw error;
	}
}
export async function installFromArchives(archives: string[]) {
	// const categories = store.get(CATEGORIES).map((cat) => cat._sName);
	let success = 0;
	async function extractArchive(archive: string) {
		if (!archive) return;
		const name = archive.split(/[/\\]/).pop()!.split(".").slice(0, -1).join(".");
		const root = join(src, managedSRC, UNCATEGORIZED);
		await mkdir(root, { recursive: true });
		let counter = 0;
		let finalName = `${name}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
		while (await exists(join(root, finalName))) {
			finalName = `${name} (${++counter})`;
		}
		const dest = join(root, finalName);
		await mkdir(dest, { recursive: true });
		try {
			info("[IMM] Extracting archive:", archive, "to", dest);
			const element = {
				name: finalName,
				path: UNCATEGORIZED + "/" + finalName,
				source: "",
				fname: archive.split(/[/\\]/).pop()!,
				category: UNCATEGORIZED,
				updatedAt: 0,
				dlPath: dest,
				key: `${finalName}_${archive.split(/[/\\]/).pop()!}_${finalName}_0`,
			} as any;
			store.set(DOWNLOAD_LIST, (prev) => {
				prev.extracting.push(element);
				return { ...prev };
			});
			addToExtracts(element.key, element);
			await invoke("extract_archive", {
				filePath: toFs(archive),
				savePath: toFs(dest),
				fileName: name,
				del: false,
				emit: true,
				key: element.key,
				currentSid: 999,
			});
			info("[IMM] Archive extracted:", archive);
			// await validateModDownload(dest, true);
			success++;
			await trackUserAction({
				action: "mod_installed",
				mod: join(UNCATEGORIZED, finalName),
				details: { source: "archive" },
			});
		} catch (err) {
			error("[IMM] Error extracting archive:", err);
			addToast({ type: "error", message: textData._Toasts.ErrInstall.replace("<item/>", name) });
		}
	}
	const extractPromises = archives.map((archive) => extractArchive(archive));
	await Promise.all(extractPromises);
	addToast({
		type: "success",
		message: textData._Toasts.SuccessInstall.replace("<success/>", success.toString()).replace(
			"<total/>",
			archives.length.toString()
		),
	});
}

import { useEffect, useMemo } from "react";
import { IMAGE_SERVER, managedSRC } from "./consts";
import {
	DATA,
	DEV_HIDE_PREVIEWS,
	FILE_TO_DL,
	FILTER,
	GAME,
	INSTALLED_ITEMS,
	MOD_CHECK_PROGRESS,
	MOD_LIST,
	ONLINE,
	ONLINE_DATA,
	ONLINE_SELECTED,
	RIGHT_SLIDEOVER_OPEN,
	SETTINGS,
	SOURCE,
	store,
} from "./vars";

import { useAtom, useAtomValue } from "jotai";
import { apiClient } from "./api";
import { join, iniPath, getModData } from "./hotreload";
import { addToast } from "@/_Toaster/ToastProvider";
import TEXT from "@/textData.json";
import { error, info } from "@/lib/logger";
import { writeTextFile } from "./fs";
import { getConfig } from "./filesys";
import { save } from "@tauri-apps/plugin-dialog";

export { join, iniPath };
let IMAGE_SERVER_URL = IMAGE_SERVER;
let HIDE_PREVIEWS = false;
store.sub(DEV_HIDE_PREVIEWS, () => {
	HIDE_PREVIEWS = store.get(DEV_HIDE_PREVIEWS);
});
export function setImageServer(url: string) {
	IMAGE_SERVER_URL = url;
}
const reservedWindowsNames = /^(con|prn|aux|nul|com\d|lpt\d)$/i;
const illegalCharacters = /[<>:"/\\|?*\x00-\x1F]/g;
export function safeLoadJson(cur: any, neww: any) {
	if (!cur || !neww) return;
	Object.keys(neww).forEach((key) => {
		if (typeof neww[key] === "object" && !Array.isArray(neww[key])) {
			cur[key] = safeLoadJson(cur[key], neww[key]) || cur[key] || {};
		} else {
			cur[key] = neww[key];
		}
	});
	return cur;
}
export function sanitizeFileName(input: string, options: any = {}): string {
	const { replacement = "_", defaultName = "untitled", maxLength = 255 } = options;

	if (typeof input !== "string") {
		return defaultName;
	}

	let sanitized = input.replace(illegalCharacters, replacement);

	const baseName = sanitized.split(".")[0];
	if (reservedWindowsNames.test(baseName)) {
		sanitized = replacement + sanitized;
	}

	sanitized = sanitized.trim().replace(/^[.]+|[.]+$/g, "");

	if (sanitized.length > maxLength) {
		sanitized = sanitized.substring(0, maxLength);

		sanitized = sanitized.trim().replace(/^[.]+|[.]+$/g, "");
	}

	if (sanitized.length === 0) {
		return defaultName;
	}
	return sanitized;
}
export function formatSize(size: number): string {
	return size < 100
		? size.toFixed(2) + "B"
		: size < 100000
			? (size / 1000).toFixed(2) + "KB"
			: size < 100000000
				? (size / 1000000).toFixed(2) + "MB"
				: (size / 1000000000).toFixed(2) + "GB";
}
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement, Event>, hideOnError = false): void {
	const target = event.currentTarget;
	if (hideOnError) {
		target.style.opacity = "0";
		target.classList.remove("fadein");
	}
	target.src = `/${store.get(GAME) || "WW"}mm.png`;
}
export function preventContextMenu(event: React.MouseEvent): void {
	event.preventDefault();
	// event.currentTarget.dispatchEvent(new MouseEvent("mouseup", { button: 2, bubbles: true }));
}
let src = "";
let check = true;
// let lastUpdated = 0;
// store.sub(LAST_UPDATED, () => {
// 	lastUpdated = Date.now();
// });
store.sub(SOURCE, () => {
	src = store.get(SOURCE);
});
store.sub(SETTINGS, () => {
	check = store.get(SETTINGS).global.chkModUpdates;
});
export function getImageUrl(path: string): string {
	return HIDE_PREVIEWS?"":`${IMAGE_SERVER_URL}/${src}/${managedSRC}/${path}`;
}
export function getTimeDifference(startTimestamp: number, endTimestamp: number) {
	const secInMinute = 60;
	const secInHour = secInMinute * 60;
	const secInDay = secInHour * 24;
	const secInYear = secInDay * 365;
	const diff = Math.abs(endTimestamp - startTimestamp);
	if (diff < secInMinute) {
		return "now";
	} else if (diff < secInHour) {
		const minutes = Math.floor(diff / secInMinute);
		return minutes + "m";
	} else if (diff < secInDay) {
		const hours = Math.floor(diff / secInHour);
		return hours + "h";
	} else if (diff < secInYear) {
		const days = Math.floor(diff / secInDay);
		return days + "d";
	} else {
		const years = Math.floor(diff / secInYear);
		return years + "y";
	}
}
export async function fetchModNoUpdates(selected: string, signal?: AbortSignal) {
	let modData = {};
	await apiClient.mod(selected, signal).then((data) => {
		if (data._idRow != selected.split("/").slice(-1)[0]) return;
		modData = data;
	});
	return modData;
}
export async function fetchMod(selected: string, controller?: AbortController) {
	let allData = {};
	//info(selected);
	await apiClient.updates(selected, controller?.signal).then(async (data) => {
		await apiClient.mod(selected, controller?.signal).then((data2) => {
			let updates =
				data._aRecords?.map((record: any) => ({
					_sText: record._sText,
					_sVersion: record._sVersion,
					_sDate: record._tsDateModified || record._tsDateAdded,
					_aChangeLog: record._aChangeLog,
					_sName: record._sName,
				})) || [];
			data2._aUpdates = updates;
			if (data._aRecords && data._aRecords.length > 0) {
				data2._eUpdate = true;
				data2._sUpdateText = data._aRecords[0]._sText;
				data2._sUpdateVersion = data._aRecords[0]._sVersion;
				data2._sUpdateDate = data._aRecords[0]._tsDateModified || data._aRecords[0]._tsDateAdded;
				data2._aUpdateChangeLog = data._aRecords[0]._aChangeLog;
				data2._sUpdateName = data._aRecords[0]._sName;
			}
			if (data2._idRow != selected.split("/").slice(-1)[0]) return;
			allData = data2;
			store.set(ONLINE_DATA, (prev) => {
				return {
					...prev,
					[selected]: data2,
				};
			});
		});
	});
	return allData;
}
export async function exportConfig(settings: any, textData: any) {
	try {
		const { gameConfig } = getConfig(settings);
		const filePath = await save({
			title: textData.ExportPop,
			defaultPath: `config${settings.global.game}.json`,
			filters: [
				{
					name: "JSON files",
					extensions: ["json"],
				},
			],
		});
		if (filePath) {
			await writeTextFile(filePath, JSON.stringify(gameConfig, null, 2));
			addToast({ type: "success", message: textData.ConfigExported });
		}
	} catch (error) {
		addToast({ type: "error", message: textData.ErrorExporting });
	}
}
const sizeLabels = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
export function formatBytes(bytes: number, size = 0): string {
	return bytes >= 1024 ? formatBytes(bytes / 1024, size + 1) : `${Math.round(bytes * 100) / 100} ${sizeLabels[size]}`;
}
export function modRouteFromURL(url: string): string {
	let modId = url?.split("mods/").pop()?.split("/")[0] || "";
	return modId ? "Mod/" + modId : "";
}
export function isOlderThanOneDay(dateStr: string) {
	const updateAgeMs = Date.now() - (dateStr ? new Date(dateStr).getTime() : 0);
	return Number.isFinite(updateAgeMs) && updateAgeMs > 86_400_000;
}
let initialCheck = true;

// Load cached data from localStorage and clean up old entries (> 30 minutes)
const oneHour = 60 * 60 * 1000;
function loadCheckedCache(): Record<string, { updated: number; status: number }> {
	try {
		const cached = localStorage.getItem("mod_check_cache");
		if (!cached) return {};
		const parsed = JSON.parse(cached);
		const now = Date.now();
		// Filter out entries older than 30 minutes
		const cleaned: Record<string, { updated: number; status: number }> = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (typeof value === "object" && value !== null && "updated" in value && "status" in value) {
				if (now - (value as any).updated < oneHour) {
					cleaned[key] = value as { updated: number; status: number };
				}
			}
		}
		// info("[IMM] Loaded checked cache:", cleaned);
		return cleaned;
	} catch {
		return {};
	}
}

// Save cached data to localStorage
function saveCheckedCache(cache: Record<string, { updated: number; status: number }>) {
	try {
		localStorage.setItem("mod_check_cache", JSON.stringify(cache));
	} catch (err) {
		error("[IMM] Error saving cache to localStorage:", err);
	}
}

const checked: Record<string, { updated: number; status: number }> = loadCheckedCache();
let now = Date.now();
export function handleInAppLink(url: string) {
	if (url.startsWith("imm://mode/")) return;
	if (url.startsWith("imm://")) {
		url = url.replace("imm://", "");
		if (!url.startsWith("http")) {
			url = "https://" + url;
		}
		const temp = url.split("/dl/");
		url = temp[0];
		if (temp[1]) {
			store.set(FILE_TO_DL, temp[1]);
		}
	}
	console.log("[IMM] Handling in-app link:", url);
	if (!url.startsWith("http")) return;
	let mod = modRouteFromURL(url);
	if (mod) {
		store.set(ONLINE, true);
		store.set(ONLINE_SELECTED, mod);
		store.set(RIGHT_SLIDEOVER_OPEN, true);
	}
}
export function useInstalledItemsManager() {
	const [installedItems, setInstalledItems] = useAtom(INSTALLED_ITEMS);
	const localData = useAtomValue(DATA);
	const modList = useAtomValue(MOD_LIST);
	const validPaths = useMemo(() => new Set(modList.map((mod) => mod.path)), [modList]);
	//info("[IMM] Valid mod paths:", Array.from(validPaths));

	useEffect(() => {
		if (installedItems.length == 0) initialCheck = true;
	}, [installedItems]);
	useEffect(() => {
		if (Object.keys(localData).length > 0) {
			now = Date.now();
			async function checkModStatus(item: any) {
				// info("[IMM] Checking mod status for", item.name);
				let modStatus = 0;
				if (!check) {
					return 0;
				}
				if (checked.hasOwnProperty(item.name) && now - (checked[item.name]?.updated || 0) < oneHour) {
					// info("[IMM] Mod status found in cache for", item.name);
					modStatus = item.updated < checked[item.name].status ? (item.viewed < checked[item.name].status ? 2 : 1) : 0;
				} else {
					try {
						info("[IMM] Fetching mod url ", modRouteFromURL(item.source),`inCache: ${checked.hasOwnProperty(item.name)} | updated: ${item.updated} | cacheUpdated: ${checked[item.name]?.updated} | now: ${now}`);
						const data = (await fetchModNoUpdates(modRouteFromURL(item.source))) as any;
						if (data._tsDateModified) {
							let latest = item.updated || 0;
							data._aFiles.forEach((file: any) => {
								latest = Math.max(latest, (file._tsDateModified || file._tsDateAdded || 0) * 1000);
							});
							modStatus = item.updated < latest ? (item.viewed < latest ? 2 : 1) : 0;
							checked[item.name] = { updated: now, status: latest };
						}
						else{
							checked[item.name] = { updated: now, status: 0 };
						}
					} catch (error) {
						return 0;
					}
				}
				// info("[IMM] Final mod status for", item.name, "is", modStatus);
				return modStatus;
			}
			async function updateInstalledItems(localDataSnapshot: any) {
				const itemsToProcess = Object.keys(localDataSnapshot)
					.filter((key) => {
						const modData = getModData(localDataSnapshot, key);
						return modData && modData.source && validPaths.has(key);
					})
					.map((key) => {
						const modData = getModData(localDataSnapshot, key)!;
						return {
							name: key,
							source: modData.source as string,
							updated: modData.updatedAt || 0,
							viewed: modData.viewedAt || 0,
							modStatus: 0,
						};
					});
				if (initialCheck) {
					setInstalledItems(itemsToProcess);
				}
				// Process items in batches of 10
				const batchSize = 10;
				const processedItems: any[] = [];
				const totalItems = itemsToProcess.length;
				const startTime = Date.now();
				store.set(MOD_CHECK_PROGRESS, { open: totalItems > 0, checked: 0, total: totalItems });
				if (!check) info("[IMM] Mod update checking is disabled.");
				for (let i = 0; i < itemsToProcess.length; i += batchSize) {
					const batch = itemsToProcess.slice(i, i + batchSize);
					const newInBatch = batch.filter((item) => !checked.hasOwnProperty(item.name));
					const batchResults = await Promise.all(
						batch.map(async (item) => {
							const modStatus = await checkModStatus(item);
							return { ...item, modStatus };
						})
					);
					processedItems.push(...batchResults);
					const checkedCount = Math.min(i + batchSize, totalItems);
					// const newCount = processedItems.filter((item) => item.modStatus === 2).length;

					store.set(MOD_CHECK_PROGRESS, { open: totalItems > 0, checked: checkedCount, total: totalItems });
					// Add 1s delay between batches (except after the last batch)
					if (i + batchSize < itemsToProcess.length && newInBatch.length > 0) {
						await new Promise((resolve) => setTimeout(resolve, 1000));
					}
				}

				const newCount = processedItems.filter((item) => item.modStatus === 2).length;
				info("[IMM] Mod status check completed. New updates found:", newCount);
				// Save the updated cache to localStorage
				saveCheckedCache(checked);

				if (initialCheck && totalItems) {
					initialCheck = false;
					setTimeout(
						() => {
							let lang = "en";
							try {
								lang = JSON.parse(localStorage.getItem("imm-lang") || '"en"');
							} catch {}
							if (newCount > 0) {
								addToast({
									type: "info",
									message: TEXT[lang as keyof typeof TEXT].NewUpdates.replace("<new/>", newCount.toString()),
									duration: 10000,
									onClick: () => {
										store.set(FILTER, (prev) => ({ ...prev, upd: "has" }));
									},
								});
							} else
								addToast({
									type: "info",
									message: TEXT[lang as keyof typeof TEXT].ModsLoaded,
								});
						},
						Math.max(3500 - (Date.now() - startTime), 0)
					);
				}
				setTimeout(() => {
					store.set(MOD_CHECK_PROGRESS, { open: false, checked: totalItems, total: totalItems });
				}, 500);
				setInstalledItems([
					...processedItems.sort((a: any, b: any) => {
						const flagDiff = b.modStatus - a.modStatus;
						if (flagDiff !== 0) return flagDiff;
						return a.name
							.toLocaleLowerCase()
							.split(/[/\\]/)
							.slice(-1)[0]
							.localeCompare(b.name.toLocaleLowerCase().split(/[/\\]/).slice(-1)[0]);
					}),
				]);
			}
			updateInstalledItems({ ...localData });
		} else {
			setInstalledItems([]);
		}
	}, [localData, modList]);
}

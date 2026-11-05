import { invoke } from "@tauri-apps/api/core";
import { GAME_ID_MAP } from "./consts";
import { exists, readTextFile, writeTextFile } from "./fs";
import { message } from "@tauri-apps/plugin-dialog";
import { join } from "./pathsep";

import { ModDataObj } from "./types";

export { join };

export function getModData(data: ModDataObj, path: string) {
	if (!data || !path) return null;
	const normalizedPath = path.replace(/[/\\]+/g, "\\").replace(/^\\+/, "");
	if (data[normalizedPath]) return data[normalizedPath];

	const key = Object.keys(data).find((k) => k.replace(/[/\\]+/g, "\\").replace(/^\\+/, "") === normalizedPath);
	return key ? data[key] : null;
}
// d3dx.ini internal paths — always uses \ (3DMigoto format inside Wine)
export function iniPath(...parts: string[]) {
	let result = parts.join("\\").replace(/[/\\]+/g, "\\");
	result = result.endsWith("\\") ? result.slice(0, -1) : result;
	result = result.startsWith("\\") ? result.slice(1) : result;
	return result;
}
export async function updateIni(tgt: string, foreground = 0) {
	tgt = tgt.split(/[/\\]/).slice(0, -1).join("\\");
	const target = join(tgt, "d3dx.ini");
	if (!(await exists(target))) return;
	try {
		const data = await readTextFile(target);
			let modified = false;
			const lines = data.split("\n").map((line) => {
				const trimmed = line.trim();
				if (trimmed.startsWith("check_foreground_window") && !trimmed.endsWith(foreground.toString())) {
					modified = true;
					return `check_foreground_window = ${foreground}`;
				}
				return line;
			});
			if (modified) await writeTextFile(target, lines.join("\n"));
	} catch (error) {
		console.error("[IMM] Failed to update hotreload INI:", error);
	}
}
export async function setHotreload(enabled: 0 | 1 | 2, game: string, target: string): Promise<void> {
	try {
		if (enabled > 0) {
			const deps = await invoke("check_hotreload_dependencies") as {
				has_dependencies: boolean;
				missing_packages: string[];
				install_command: string;
			};

			if (!deps.has_dependencies) {
				await message(`Linux Hotreload is currently disabled.\n\nYou are missing the following required packages:\n${deps.missing_packages.join(", ")}\n\nPlease run the following command to install them:\n${deps.install_command}`, { title: 'Missing Wayland Dependencies', kind: 'error' });
				enabled = 0;
			}
		}

		if (enabled == 1) {
			updateIni(target, 0);
		} else {
			updateIni(target, 1);
		}
		await invoke("set_hotreload", { enabled: enabled ? true : false });
		if (enabled) {
            //info("Setting hotreload for game:", { targetGame: enabled == 1 || !game ? 0 : GAME_ID_MAP[game] + 1 });
			await invoke("set_window_target", { targetGame: enabled == 1 || !game ? 0 : GAME_ID_MAP[game] + 1 });
			await startWindowMonitoring();
		} else await stopWindowMonitoring();
	} catch (error) {
		// logger.error("Failed to set hotreload:", error);
		throw error;
	}
}
export async function setChange(trigger = true): Promise<void> {
	try {
		await invoke("set_change", { trigger });
	} catch (error) {
		// logger.error("Failed to set change trigger:", error);
		throw error;
	}
}
export async function startWindowMonitoring(): Promise<void> {
	try {
		await invoke("start_window_monitoring");
	} catch (error) {
		// logger.error("Failed to start window monitoring:", error);
		throw error;
	}
}
export async function stopWindowMonitoring(): Promise<void> {
	try {
		await invoke("stop_window_monitoring");
	} catch (error) {
		// logger.error("Failed to stop window monitoring:", error);
		throw error;
	}
}

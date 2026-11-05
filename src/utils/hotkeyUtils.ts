import { PRIORITY_KEYS } from "./consts";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import { invoke } from "@tauri-apps/api/core";
import { CURRENT_PRESET, MOD_LIST, PRESETS, store } from "./vars";
import { applyPreset, refreshModList } from "./filesys";

export function formatKeysToDisplay(hotkey: string): string {
	const replacements = {
		numpad: "Num-",
		escape: "Esc",
		comma: ",",
		space: "Space",
		backspace: "Backspace",
		plus: "+",
		minus: "-",
		multiply: "*",
		divide: "/",
		decimal: ".",
		enter: "↵",
		backquote: "`",
		backslash: "\\",
		bracketleft: "[",
		bracketright: "]",
		semicolon: ";",
		quote: "'",
		period: ".",
		slash: "/",
		equal: "=",
		up: "🠉",
		down: "🠋",
		left: "🠈",
		right: "🠊",
		lbutton: "LMB",
		rbutton: "RMB",
		key: "",
		digit: "",
		arrow: "",
	} as Record<string, string>;
	return hotkey
		.toLowerCase()
		.replaceAll("+", "xx+xx")
		.replaceAll(/(?:control|ctrl|alt|shift|meta|win|super)(?:right|left)?/gi, (match) => {
			const base = match.toLowerCase();
			if (base.includes("alt")) return "Alt";
			if (base.includes("shift")) return "Shift";
			if (base.includes("meta") || base.includes("win") || base.includes("super")) return "Win";
			return "Ctrl";
		})
		.replaceAll(
			/(numpad|escape|comma|space|backspace|plus|minus|multiply|divide|decimal|enter|backquote|backslash|bracketleft|bracketright|semicolon|quote|period|slash|equal|up|down|left|right|lbutton|rbutton|key|digit|arrow)/gi,
			(match) => {
				return replacements[match];
			}
		)
		.replace(/^f(\d+)$/, "F$1")
		.replaceAll("xx+xx", " ﹢ ");
}
export function encodeHotkeyForStorage(displayString: string): string {
	const inverseReplacements = {
		ctrl: "control",
		win: "super",
		"num-": "numpad",
		esc: "escape",
		",": "comma",
		space: "space",
		backspace: "backspace",
		"+": "plus",
		"-": "minus",
		"*": "multiply",
		"/": "divide",
		".": "decimal",
		"↵": "enter",
		"`": "backquote",
		"\\": "backslash",
		"[": "bracketleft",
		"]": "bracketright",
		";": "semicolon",
		"'": "quote",
		"=": "equal",
		"🠉": "arrowup",
		"🠋": "arrowdown",
		"🠈": "arrowleft",
		"🠊": "arrowright",
		lmb: "lbutton",
		rmb: "rbutton",
	} as Record<string, string>;

	const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	const inversePattern = new RegExp(
		Object.keys(inverseReplacements)
			.sort((a, b) => b.length - a.length)
			.map(escapeRegExp)
			.join("|"),
		"gi"
	);
	return displayString
		.toLowerCase()
		.replaceAll(" ﹢ ", "xxplusxx")
		.replaceAll(inversePattern, (match) => inverseReplacements[match.toLowerCase()])
		.replaceAll("xxplusxx", "+");
}
export function sortHotkeys(keys: string[]): string[] {
	const prioritySet = new Set<string>(PRIORITY_KEYS);
	const regularKeys = keys.filter((key) => !prioritySet.has(key));

	regularKeys.sort((a, b) => {
		if (a.length !== b.length) {
			return a.length - b.length;
		}
		return a.localeCompare(b);
	});

	const inputKeysSet = new Set(keys);
	const presentPriorityKeys = PRIORITY_KEYS.filter((key) => inputKeysSet.has(key));
	return [...presentPriorityKeys, ...regularKeys];
}
const queue: string[] = [];
export async function registerGlobalHotkeys(): Promise<void> {
	const id = Date.now() + "" + Math.random();
	queue.push(id);
	while (queue[0] !== id) {
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	try {
		try {
			await unregisterAll();
		} catch (error) {
			console.log("Error unregistering hotkeys:", error);
		}

		const currentPresets = store.get(PRESETS);
		const validHotkeys = currentPresets
			.filter((preset) => preset?.hotkey && preset?.hotkey.trim() !== "")
			.map((preset) => preset?.hotkey);
		//info("Valid hotkeys to register:", validHotkeys);
		if (validHotkeys.length === 0) {
			//logger.log("No valid hotkeys found to register");
			return;
		}
		console.log("Registering hotkeys:", validHotkeys);
		//logger.log("Registering hotkeys:", validHotkeys);
		await register(validHotkeys as any, (event) => {
			//logger.log("Hotkey pressed:", event);
			console.log("Hotkey pressed:", event);
			if (event.state === "Pressed") {
				const freshPresets = store.get(PRESETS).filter((preset) => preset?.hotkey && preset?.hotkey.trim() !== "");

				let normalizedShortcut = event.shortcut
					.toLowerCase()
					.replaceAll("alt", "Alt")
					.replaceAll("control", "Ctrl")
					.replaceAll("shift", "Shift")
					.replaceAll("meta", "Win")
					.replaceAll("super", "Win")
					.replaceAll("key", "")
					.replaceAll("digit", "");
				normalizedShortcut = encodeHotkeyForStorage(
					sortHotkeys(normalizedShortcut.split("+")).join(" ﹢ ").toLowerCase()
				);
				//info("Hotkey pressed:", normalizedShortcut);
				console.log("Hotkey pressed:", normalizedShortcut);
				const matchedPreset = freshPresets.find((preset) => {
					// logger.debug("Comparing:", preset.hotkey, "vs", normalizedShortcut);
					return preset?.hotkey?.toLowerCase() === normalizedShortcut;
				});
				if (matchedPreset) {
					//logger.log("Matched preset:", matchedPreset);

					(async () => {
						try {
							const allPresets = store.get(PRESETS);
							const presetIndex = allPresets.findIndex((p) => p === matchedPreset);

							store.set(CURRENT_PRESET, presetIndex);
							await applyPreset(matchedPreset.data, matchedPreset.name);
							store.set(MOD_LIST, await refreshModList());

							invoke("focus_mod_manager_send_f10_return_to_game");
							//logger.log("Preset applied successfully:", matchedPreset.name);
						} catch (error) {
							// logger.error("Error applying preset:", error);
						}
					})();
				} else {
					//logger.log("No matching preset found for hotkey:", normalizedShortcut);
				}
			}
		});
	} finally {
		queue.shift();
	}
}
const vkReplacements = {
	// Modifiers
	vk_lcontrol: "Ctrl",
	vk_rcontrol: "Ctrl",
	vk_control: "Ctrl",
	vk_lmenu: "Alt",
	vk_rmenu: "Alt",
	vk_menu: "Alt",
	vk_lshift: "Shift",
	vk_rshift: "Shift",
	vk_shift: "Shift",
	vk_lwin: "Win",
	vk_rwin: "Win",

	// Navigation & Editing
	vk_escape: "Esc",
	vk_space: "Space",
	vk_back: "Backspace",
	vk_return: "↵",
	vk_tab: "Tab",
	vk_prior: "PageUp",
	vk_next: "PageDown",
	vk_end: "End",
	vk_home: "Home",
	vk_insert: "Insert",
	vk_delete: "Delete",

	// Arrows
	vk_up: "🠉",
	vk_down: "🠋",
	vk_left: "🠈",
	vk_right: "🠊",

	// Mouse Buttons
	vk_lbutton: "LMB",
	vk_rbutton: "RMB",
	vk_mbutton: "MMB",

	// Numpad
	vk_numpad0: "Num-0",
	vk_numpad1: "Num-1",
	vk_numpad2: "Num-2",
	vk_numpad3: "Num-3",
	vk_numpad4: "Num-4",
	vk_numpad5: "Num-5",
	vk_numpad6: "Num-6",
	vk_numpad7: "Num-7",
	vk_numpad8: "Num-8",
	vk_numpad9: "Num-9",
	vk_multiply: "*",
	vk_add: "+",
	vk_subtract: "-",
	vk_decimal: ".",
	vk_divide: "/",

	// OEM Punctuation / Symbol Keys
	vk_oem_plus: "+",
	vk_oem_comma: ",",
	vk_oem_minus: "-",
	vk_oem_period: ".",
	vk_oem_1: ";",
	vk_oem_2: "/",
	vk_oem_3: "`",
	vk_oem_4: "[",
	vk_oem_5: "\\",
	vk_oem_6: "]",
	vk_oem_7: "'",
} as Record<string, string>;

export function vkToDisplay(vkString: string): string {
	if (!vkString.trim()) return "";
	if (vkString.toUpperCase() == "D I S A B L E") {
		return "DISABLED";
	}

	return vkString
		.split(/\s+/)
		.filter((part) => {
			const lower = part.toLowerCase();
			return lower !== "no_ctrl" && lower !== "no_shift" && lower !== "no_alt";
		})
		.map((part) => {
			const key = part.toLowerCase();
			if (vkReplacements[key] !== undefined) {
				return vkReplacements[key];
			}
			if (key.startsWith("vk_")) {
				const stripped = part.substring(3);
				return stripped.charAt(0).toUpperCase() + stripped.slice(1).toLowerCase();
			}
			return formatKeysToDisplay(part);
		})
		.join(" ﹢ ");
}

export function encodeToVK(displayString: string): string {
	if (!displayString.trim()) return "";
	if (displayString === "DISABLED")
		return "D I S A B L E";
	const inverseVkReplacements = {
		ctrl: "VK_CONTROL",
		alt: "VK_MENU",
		shift: "VK_SHIFT",
		win: "VK_LWIN",
		esc: "VK_ESCAPE",
		space: "VK_SPACE",
		backspace: "VK_BACK",
		"↵": "VK_RETURN",
		tab: "VK_TAB",
		pageup: "VK_PRIOR",
		pagedown: "VK_NEXT",
		end: "VK_END",
		home: "VK_HOME",
		insert: "VK_INSERT",
		delete: "VK_DELETE",
		"🠉": "VK_UP",
		"🠋": "VK_DOWN",
		"🠈": "VK_LEFT",
		"🠊": "VK_RIGHT",
		lmb: "VK_LBUTTON",
		rmb: "VK_RBUTTON",
		mmb: "VK_MBUTTON",
		"num-0": "VK_NUMPAD0",
		"num-1": "VK_NUMPAD1",
		"num-2": "VK_NUMPAD2",
		"num-3": "VK_NUMPAD3",
		"num-4": "VK_NUMPAD4",
		"num-5": "VK_NUMPAD5",
		"num-6": "VK_NUMPAD6",
		"num-7": "VK_NUMPAD7",
		"num-8": "VK_NUMPAD8",
		"num-9": "VK_NUMPAD9",
		"*": "VK_MULTIPLY",
		"+": "VK_OEM_PLUS",
		"-": "VK_OEM_MINUS",
		".": "VK_OEM_PERIOD",
		"/": "VK_OEM_2",
		";": "VK_OEM_1",
		"`": "VK_OEM_3",
		"[": "VK_OEM_4",
		"\\": "VK_OEM_5",
		"]": "VK_OEM_6",
		"'": "VK_OEM_7",
	} as Record<string, string>;

	let hasCtrl = false;
	let hasShift = false;
	let hasAlt = false;

	const vkKeys = displayString.split(/\s*﹢\s*/).map((part) => {
		const cleanPart = part.trim();
		const key = cleanPart.toLowerCase();

		if (key === "ctrl") hasCtrl = true;
		if (key === "shift") hasShift = true;
		if (key === "alt") hasAlt = true;

		if (inverseVkReplacements[key] !== undefined) {
			return inverseVkReplacements[key];
		}
		if (/^f\d+$/i.test(cleanPart)) {
			return `VK_${cleanPart.toUpperCase()}`;
		}
		return cleanPart.toUpperCase();
	});

	if (!hasCtrl) vkKeys.unshift("no_ctrl");
	if (!hasShift) vkKeys.unshift("no_shift");
	if (!hasAlt) vkKeys.unshift("no_alt");

	return vkKeys.join(" ");
}
store.sub(PRESETS, () => {
	registerGlobalHotkeys();
});

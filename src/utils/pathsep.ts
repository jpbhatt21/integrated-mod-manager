// Cross-platform path separator handling.
//
// Internally the whole app uses "\\" (Windows-style) as the canonical
// separator for every path and key: stored config keys, presets, mod paths,
// d3dx.ini namespace keys and all string comparisons. This keeps existing
// Windows data and the d3dx data format (which is always "\\", because the
// game runs under Wine even on Linux) working unchanged.
//
// We only translate at the boundaries:
//   - toInternal(): call on paths ENTERING from the OS (dialogs, path.*Dir(),
//     deep links) so the internal representation stays uniformly "\\".
//   - toFs(): call on paths LEAVING to the OS (filesystem calls, openPath,
//     IPC). On Windows the native separator is already "\\" so this is a
//     no-op and Windows behaviour is byte-identical; on Linux it produces
//     forward-slash paths.

import { DATA_PATH, store } from "./vars";

const NATIVE_SEP = typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent) ? "\\" : "/";

/** Join path/key segments using the internal "\\" separator. */
export function join(...parts: (string | null | undefined)[]) {
	let result = parts
		.filter((p): p is string => p !== "" && p != null)
		.join("\\")
		.replaceAll("/", "\\")
		.replaceAll("\\\\", "\\");
	if (result.endsWith("\\")) result = result.slice(0, -1);
	return result;
}
/**
 * Parent directory of an internal path: "\\run\\media\\Mods\\x" gives "\\run\\media\\Mods".
 * Keeps the leading "\\" of absolute Linux paths. join() drops it, and toFs() then resolves
 * the path against the app data dir.
 */
export function parentDir(p: string) {
	// Remove trailing separators: "\\a\\b\\" becomes "\\a\\b".
	const trimmed = p.replace(/[\\/]+$/, "");
	// Remove the last separator and everything after it: "\\a\\b" becomes "\\a".
	return trimmed.replace(/[\\/][^\\/]*$/, "");
}
let dataPath: string | null = null;
store.sub(DATA_PATH, () => {
	dataPath = store.get(DATA_PATH);
});
/** Convert an OS-native path into the internal "\\" form. */
export function toInternal<T extends string | null | undefined>(p: T): T {
	return (typeof p === "string" ? p.replaceAll("/", "\\") : p) as T;
}

/** Convert an internal "\\" path into the OS-native form. */
export function toFs<T extends string | null | undefined>(p: T): T {

	if (dataPath && p && typeof p === "string" && /^[a-zA-Z]/.test(p) && !p.startsWith('home'))
		p = join(dataPath, p) as T;
	return (typeof p === "string" ? p.replaceAll("\\", NATIVE_SEP) : p) as T;
}

// Thin wrapper around @tauri-apps/plugin-fs that translates the app's internal
// "\\"-separated paths into the OS-native form before hitting the filesystem.
// Only PATH arguments are translated — never the data payloads (e.g. d3dx.ini
// content keeps its "\\" namespace keys). Import these instead of importing
// from "@tauri-apps/plugin-fs" directly.
import * as fs from "@tauri-apps/plugin-fs";
import { toFs, toInternal } from "./pathsep";

function normalizeDirEntry<T extends fs.DirEntry>(entry: T): T {
	return {
		...entry,
		name: toInternal(entry.name),
		...("path" in entry && typeof entry.path === "string" ? { path: toInternal(entry.path) } : {}),
		...("children" in entry && Array.isArray(entry.children)
			? { children: entry.children.map((child) => normalizeDirEntry(child)) }
			: {}),
	};
}

export const readTextFile = (path: string, options?: fs.ReadFileOptions) => fs.readTextFile(toFs(path), options);

export const writeTextFile = (path: string, data: string, options?: fs.WriteFileOptions) =>
	fs.writeTextFile(toFs(path), data, options);

export const exists = (path: string, options?: fs.ExistsOptions) => fs.exists(toFs(path), options);

export const readDir = async (path: string, options?: fs.ReadDirOptions) =>
	(await fs.readDir(toFs(path), options)).map((entry) => normalizeDirEntry(entry));

export const mkdir = (path: string, options?: fs.MkdirOptions) => fs.mkdir(toFs(path), options);

export const remove = (path: string, options?: fs.RemoveOptions) => fs.remove(toFs(path), options);

export const rename = (oldPath: string, newPath: string, options?: fs.RenameOptions) =>
	fs.rename(toFs(oldPath), toFs(newPath), options);

export const copyFile = (fromPath: string, toPath: string, options?: fs.CopyFileOptions) =>
	fs.copyFile(toFs(fromPath), toFs(toPath), options);

export const writeFile = (path: string, data: Uint8Array, options?: fs.WriteFileOptions) =>
	fs.writeFile(toFs(path), data, options);

export async function atomicWriteTextFile(path: string, data: string): Promise<void> {
	const suffix = `${Date.now()}-${crypto.randomUUID()}`;
	const temporary = `${path}.tmp-${suffix}`;
	const previous = `${path}.previous-${suffix}`;
	const hadOriginal = await exists(path);

	await writeTextFile(temporary, data);
	try {
		if (hadOriginal) await rename(path, previous);
		await rename(temporary, path);
		if (hadOriginal) await remove(previous);
	} catch (error) {
		if (await exists(temporary)) await remove(temporary).catch(() => undefined);
		if (hadOriginal && (await exists(previous)) && !(await exists(path))) {
			await rename(previous, path).catch(() => undefined);
		}
		throw error;
	}
}

import { invoke } from "@tauri-apps/api/core";
import { DOWNLOAD_LIST, store } from "./vars";
import { DownloadItem, DownloadList } from "./types";
import { cleanCancelledDownload } from "./filesys";

export function activeDownloads(downloads: DownloadList): DownloadItem[] {
	const downloading = Array.isArray(downloads.downloading) ? downloads.downloading : downloads.downloading ? [downloads.downloading] : [];
	return [...downloading, ...(downloads.extracting || [])];
}

export async function confirmAndCancelDownloadsForGameSwitch() {
	const downloads = store.get(DOWNLOAD_LIST);
	const active = activeDownloads(downloads);
	if (!active.length) return true;

	const groups = new Map<string, string[]>();
	for (const item of active) {
		const rawStatus = String(item.status || "downloading").toLowerCase();
		const status = rawStatus.includes("extract") ? "Extracting" : rawStatus.includes("pending") || rawStatus.includes("queue") ? "Pending" : "Downloading";
		const items = groups.get(status) || [];
		items.push(`- ${item.name || item.fname || item.key}`);
		groups.set(status, items);
	}
	const list = ["Downloading", "Extracting", "Pending"]
		.filter((status) => groups.has(status))
		.map((status) => `${status}:\n${groups.get(status)!.join("\n")}`)
		.join("\n\n");
	const queued = downloads.queue?.length ? `\n\nQueued downloads: ${downloads.queue.length}` : "";
	const ok = await new Promise<boolean>((resolve) => {
		window.dispatchEvent(new CustomEvent("download-switch-confirm", { detail: { message: `Downloads are still running:\n\n${list}${queued}\n\nWait for them to complete, or continue and cancel all downloads.`, resolve } }));
	});
	if (!ok) return false;

	await invoke("get_username").catch(() => {});
	await Promise.all(active.map((item) => (item.dlPath ? cleanCancelledDownload(item.dlPath).catch(() => {}) : undefined)));
	store.set(DOWNLOAD_LIST, (prev) => ({
		...prev,
		queue: [],
		downloading: [],
		extracting: [],
	}));
	return true;
}

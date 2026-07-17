import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Check, Clock, DownloadIcon, FileQuestionIcon, FolderArchiveIcon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { CATEGORIES, DATA, DOWNLOAD_LIST, LEFT_SIDEBAR_OPEN, MOD_LIST, SETTINGS, TEXT_DATA } from "@/utils/vars";
import { formatBytes, sanitizeFileName } from "@/utils/utils";
import { toFs } from "@/utils/pathsep";
import {
	cleanCancelledDownload,
	createModDownloadDir,
	getModDetails,
	refreshModList,
	saveConfigs,
	validateModDownload,
} from "@/utils/filesys";
import { DownloadItem, ModData, ModDataObj } from "@/utils/types";
import { UNCATEGORIZED } from "@/utils/consts";
import { info } from "@/lib/logger";
import { trackUserAction } from "@/utils/userStats";

type DownloadQueueItem = DownloadItem & {
	dlPath?: string;
	error?: string;
	path?: string;
	updatedAt?: number;
};
type ProgressState = { percent: number; text: string };

const externalExtracts = {} as Record<string, DownloadQueueItem>;
export function addToExtracts(key: string, element: any) {
	externalExtracts[key] = element;
}

const Icons = {
	pending: <Clock className="min-h-4 min-w-4 max-w-4" />,
	downloading: <Loader2 className="min-h-4 min-w-4 max-w-4 animate-spin" />,
	completed: <Check className="min-h-4 min-w-4 max-w-4" />,
	failed: <X className="min-h-4 min-w-4 max-w-4 text-destructive" />,
	extracting: <FolderArchiveIcon className="min-h-4 min-w-4 max-w-4 animate-pulse" />,
};

function Downloads() {
	const textData = useAtomValue(TEXT_DATA);
	const [downloads, setDownloads] = useAtom(DOWNLOAD_LIST);
	const categories = useAtomValue(CATEGORIES);
	const [data, setData] = useAtom(DATA);
	const [dialogOpen, setDialogOpen] = useState(false);
	const leftSidebarOpen = useAtomValue(LEFT_SIDEBAR_OPEN);
	const maxConcurrentDownloads = Math.max(1, useAtomValue(SETTINGS).global.maxConcurrentDownloads || 1);
	const modList = useSetAtom(MOD_LIST);
	const headerRef = useRef<HTMLDivElement>(null);
	const collapsedRef = useRef<HTMLDivElement>(null);
	const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const speedRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const currentPathRef = useRef<Record<string, string>>({});
	const activeDownloadsRef = useRef<Record<string, DownloadQueueItem>>({});
	const extractsRef = useRef<Record<string, DownloadQueueItem>>(externalExtracts);
	const progressRef = useRef<Record<string, ProgressState>>({});
	const lastSpeedUpdate = useRef<Record<string, number>>({});
	const [progressView, setProgressView] = useState<Record<string, ProgressState>>({});
	const launchingRef = useRef(false);

	const resetProgress = (key: string) => {
		delete progressRef.current[key];
		delete lastSpeedUpdate.current[key];
		setProgressView((prev) => {
			const next = { ...prev };
			delete next[key];
			return next;
		});
		if (speedRefs.current[key]) speedRefs.current[key].textContent = " • ";
		if (rowRefs.current[key]) rowRefs.current[key].style.width = "0%";
	};
	const getProgress = (key?: string) =>
		key ? progressView[key] || { percent: 0, text: " • " } : { percent: 0, text: " • " };

	const markDownloadFailed = (key: string, message: string, stage = "download") => {
		const activeFailed = activeDownloadsRef.current[key] || null;
		const extractingFailed = extractsRef.current[key] || externalExtracts[key];
		const failedItem = activeFailed || extractingFailed;
		if (!failedItem) return;

		info("[IMM] Download failed:", key, stage, message);
		if (activeFailed && currentPathRef.current[key]) cleanCancelledDownload(currentPathRef.current[key]);
		delete activeDownloadsRef.current[key];
		delete currentPathRef.current[key];
		delete extractsRef.current[key];
		delete externalExtracts[key];
		resetProgress(key);
		setDownloads((prev) => ({
			...prev,
			downloading: (prev.downloading || []).filter((item) => item.key !== key),
			extracting: prev.extracting?.filter((item) => item.key !== key) || [],
			completed: [
				...(prev.completed || []),
				{ ...failedItem, status: "failed", error: message || stage } as DownloadItem,
			],
		}));
	};
	// const resetAllProgress = () => {
	// 	progressRef.current = {};
	// 	lastSpeedUpdate.current = {};
	// 	setProgressView({});
	// 	Object.values(rowRefs.current).forEach((ref) => {
	// 		if (ref) ref.style.width = "0%";
	// 	});
	// 	if (headerRef.current) headerRef.current.style.width = "0%";
	// 	if (collapsedRef.current) {
	// 		collapsedRef.current.style.background = "conic-gradient( var(--accent) 0% 0%, var(--button) 0% 100%)";
	// 	}
	// };

	const prepareDownload = async (item: DownloadItem): Promise<DownloadQueueItem> => {
		const category =
			item.category == "Other/Misc"
				? "Other"
				: categories.find((cat) => cat._sName == item.category)
					? item.category
					: UNCATEGORIZED;
		const name = sanitizeFileName(item.name);
		const modPath = category + "\\" + name;
		const dlPath = (await createModDownloadDir(category, name)) as string;
		return {
			...item,
			status: "downloading",
			name,
			path: modPath,
			category,
			updatedAt: item.updated * 1000,
			dlPath,
			key: `${name}_${item.file}_${item.fname}_${item.updated}`,
			operation: data[modPath] ? "update" : "install",
		};
	};

	const startDownload = async (item: DownloadQueueItem) => {
		if (!item.key || !item.dlPath) return;
		currentPathRef.current[item.key] = item.dlPath;
		activeDownloadsRef.current[item.key] = item;
		let dataReq = {} as ModData;
		setData((prevData) => {
			if (!item.path) return prevData;
			dataReq = prevData[item.path] || {};
			return {
				...prevData,
				[item.path]: {
					source: item.source,
					updatedAt: prevData[item.path]?.updatedAt || -1,
					...prevData[item.path],
				},
			};
		});
		if (Object.keys(dataReq).length > 0 && item.path) {
			const details = await getModDetails(item.path, dataReq as any as ModDataObj);
			// console.log("in", details)
			let modData = dataReq.vars || {};
			const applyModData = (key: any) => {
				const nextKey = { ...key };
				nextKey.ns = nextKey.namespace || nextKey.file;
				if (modData[nextKey.ns] && modData[nextKey.ns][nextKey.target]) {
					nextKey.pref = modData[nextKey.ns][nextKey.target].pref;
					nextKey.reset = modData[nextKey.ns][nextKey.target].reset;
					nextKey.name = modData[nextKey.ns][nextKey.target].name || nextKey.target;
					nextKey.state = modData[nextKey.ns][nextKey.target].state || null;
					nextKey.keyReset = modData[nextKey.ns][nextKey.target].keyReset || null;
				}
				return nextKey;
			};
			const data = details.keys.map(applyModData).filter((key) => key.reset || key.keyReset);
			sessionStorage.setItem("modData_" + item.path, JSON.stringify(data));
		}
		saveConfigs();
		invoke("download_and_unzip", {
			fileName: item.name,
			downloadUrl: item.file,
			savePath: toFs(item.dlPath),
			key: item.key,
			emit: true,
		}).catch((err) => markDownloadFailed(item.key || "", String(err), "download"));
		if (item.preview) {
			invoke("download_and_unzip", {
				fileName: "preview",
				downloadUrl: item.preview,
				savePath: toFs(item.dlPath),
				key: "link_preview_" + item.name,
				emit: false,
			}).catch(() => {});
		}
	};

	useEffect(() => {
		const unlisteners: Array<() => void> = [];
		let disposed = false;
		const addListener = async (eventName: string, handler: (event: any) => void) => {
			const unlisten = await listen(eventName, handler);
			if (disposed) unlisten();
			else unlisteners.push(unlisten);
		};
		addListener("download-progress", (event) => {
			const payload = event.payload as any;
			const key = payload.key as string;
			if (!activeDownloadsRef.current[key]) return;
			const total = payload.total as number;
			const downloaded = payload.downloaded as number;
			const percent = total > 0 ? Number(((downloaded / total) * 100).toFixed(2)) : 0;
			const text = ` • ${percent}% (${formatBytes(downloaded)}/${formatBytes(total)}) • ${payload.speed} • ${payload.eta} • `;
			progressRef.current[key] = { percent, text };
			const now = Date.now();
			if (now - (lastSpeedUpdate.current[key] || 0) >= 1000) {
				setProgressView((prev) => ({ ...prev, [key]: progressRef.current[key] }));
				if (speedRefs.current[key]) speedRefs.current[key].textContent = text;
				lastSpeedUpdate.current[key] = now;
			}
			if (rowRefs.current[key]) rowRefs.current[key].style.width = percent + "%";
		});
		addListener("ext", (event) => {
			const payload = event.payload as any;
			const key = payload.key as string;
			const downloadElement = activeDownloadsRef.current[key];
			if (!downloadElement) return;
			delete currentPathRef.current[key];
			delete activeDownloadsRef.current[key];
			resetProgress(key);
			setDownloads((prev) => ({
				...prev,
				downloading: (prev.downloading || []).filter((item) => item.key !== key),
				extracting: [...(prev.extracting || []), downloadElement],
			}));
			extractsRef.current[key] = { ...downloadElement };
		});
		addListener("fin", async (event) => {
			const payload = event.payload as any;
			const key = payload.key as string;
			const type = payload.type || ("auto" as string);
			const finishedElement = extractsRef.current[key] || externalExtracts[key];
			if (!finishedElement) return;
			info("[IMM] Extraction finished for key:", key);
			delete extractsRef.current[key];
			delete externalExtracts[key];
			console.log("[IMM] Finished element:", finishedElement, "Dlpath:", finishedElement.dlPath, "Type:", type);
			if (!finishedElement.dlPath) return;
			await validateModDownload(finishedElement.dlPath, type == "manual");
			if (type == "auto") {
				const now = Date.now();
				setData((prev) => {
					if (!finishedElement.path) return prev;
					return {
						...prev,
						[finishedElement.path]: {
							addedAt: now,
							...prev[finishedElement.path],
							source: finishedElement.source,
							updatedAt: finishedElement.updatedAt || now,
							installedAt: now,
							viewedAt: now,
						},
					};
				});
				modList(await refreshModList());
				saveConfigs();
				if (finishedElement.path) {
					await trackUserAction({
						action: finishedElement.operation === "update" ? "mod_updated" : "mod_installed",
						mod: finishedElement.path,
						details: { source: "online" },
					});
				}
			}
			setDownloads((prev) => ({
				...prev,
				completed: [...(prev.completed || []), { ...finishedElement, status: "completed" } as DownloadItem],
				extracting: prev.extracting?.filter((item: any) => item.key !== key) || [],
			}));
		});
		addListener("download-error", (event) => {
			const payload = event.payload as any;
			markDownloadFailed(payload.key || "", payload.message || "Download failed", payload.stage || "download");
		});
		return () => {
			disposed = true;
			unlisteners.forEach((unlisten) => unlisten());
		};
	}, []);

	useEffect(() => {
		if (launchingRef.current || !downloads.queue.length) return;
		const slots = Math.max(0, maxConcurrentDownloads - (downloads.downloading || []).length);
		if (!slots) return;
		launchingRef.current = true;
		const count = Math.min(slots, downloads.queue.length);
		const items = downloads.queue.slice(0, count);
		Promise.all(items.map(prepareDownload))
			.then((prepared) => {
				setDownloads((prev) => ({
					...prev,
					queue: prev.queue.slice(prepared.length),
					downloading: [...(prev.downloading || []), ...prepared],
				}));
				prepared.forEach(startDownload);
			})
			.finally(() => {
				launchingRef.current = false;
			});
	}, [downloads.queue.length, downloads.downloading.length, maxConcurrentDownloads]);

	const clearCompleted = () => setDownloads((prev) => ({ ...prev, completed: [] }));
	const cancelExtract = (key: string) => {
		invoke("cancel_extract", { key }).catch(() => {});
		setDownloads((prev) => ({
			...prev,
			extracting: prev.extracting?.filter((item) => item.key !== key) || [],
		}));
	};
	const cancelActiveDownload = (item: DownloadQueueItem) => {
		if (!item.key) return;
		invoke("cancel_extract", { key: item.key }).catch(() => {});
		if (item.dlPath) cleanCancelledDownload(item.dlPath);
		delete currentPathRef.current[item.key];
		delete activeDownloadsRef.current[item.key];
		resetProgress(item.key);
		setDownloads((prev) => ({
			...prev,
			downloading: (prev.downloading || []).filter((download) => download.key !== item.key),
			completed: [...(prev.completed || []), { ...item, status: "failed", error: "cancelled" } as DownloadItem],
		}));
	};
	const cancelDownload = (index: number) => {
		const activeCount = downloads.downloading.length;
		if (index < activeCount) return cancelActiveDownload(downloads.downloading[index] as DownloadQueueItem);
		index = index - activeCount - downloads.extracting.length;
		const type = index < downloads.queue.length ? "queue" : "completed";
		index = type == "queue" ? index : index - downloads.queue.length;
		setDownloads((prev) => ({
			...prev,
			[type]: prev[type].filter((_: any, i: number) => i !== index),
		}));
	};

	const done = downloads?.completed?.filter((item) => item.status !== "failed").length || 0;
	let downloadList: DownloadQueueItem[] = [
		...(downloads.downloading || []).map((item) => ({ ...item, status: "downloading" as const })),
		...(downloads.extracting || []).map((item) => ({ ...item, status: "extracting" as const })),
		...(downloads.queue || []).map((item) => ({ ...item, status: "pending" as const })),
		...(downloads.completed || []).map((item) => ({
			...item,
			status: (item.status || "completed") as DownloadItem["status"],
		})),
	];
	const primaryDownload = downloadList.find((item) => item.status === "downloading") || downloadList[0];
	const primaryProgress = getProgress(primaryDownload?.key);

	useEffect(() => {
		if (headerRef.current) headerRef.current.style.width = primaryProgress.percent + "%";
		if (collapsedRef.current) {
			collapsedRef.current.style.background =
				"conic-gradient( var(--accent) 0% " + primaryProgress.percent + "%, var(--button) 0% 100%)";
		}
	}, [primaryProgress.percent]);

	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DialogTrigger asChild>
				<Button
					className="text-ellipsis min-h-12 shrink-0  max-h-12 min-w -80 flex flex-col items-center w-full px-0 overflow-hidden"
					style={{ width: leftSidebarOpen ? "" : "3rem" }}
				>
					{leftSidebarOpen ? (
						downloadList.length > 0 ? (
							<div className="fade-in min-h-12 flex flex-col items-center justify-center w-full overflow-hidden rounded-md pointer-events-none">
								<div
									ref={headerRef}
									className="min-h-12 height-in zzz-rounded bg-accent bgaccent text-background hover:brightness-125 z-10 flex flex-col self-start justify-center -mb-12 overflow-hidden rounded-lg"
									style={{ width: primaryProgress.percent + "%" }}
								>
									<div className="min-w-79 fade-in flex items-center justify-center gap-1 pointer-events-none">
										{Icons[primaryDownload.status as keyof typeof Icons] || (
											<FileQuestionIcon className="min-h-4 min-w-4" />
										)}
										<Label className="min-w-2 max-w-71.5 w-fit py-2 pr-2" style={{ backgroundColor: "#fff0" }}>
											{primaryDownload.status == "downloading"
												? `${textData._LeftSideBar._components._Downloads.Downloading} ${done + downloads.downloading.length}/${downloadList.length}`
												: `${textData._LeftSideBar._components._Downloads.Downloaded} ${done}/${downloadList.length}`}
										</Label>
									</div>
								</div>
								<div className="fade-in min-h-12 flex items-center justify-center w-full gap-1 pointer-events-none">
									{Icons[primaryDownload.status as keyof typeof Icons] || (
										<FileQuestionIcon className="min-h-4 min-w-4" />
									)}
									<Label className=" w-fit max-w-72 pr-2 pointer-events-none">
										{primaryDownload.status == "downloading"
											? `${textData._LeftSideBar._components._Downloads.Downloading} ${done + downloads.downloading.length}/${downloadList.length}`
											: `${textData._LeftSideBar._components._Downloads.Downloaded} ${done}/${downloadList.length}`}
									</Label>
								</div>
							</div>
						) : (
							<div className="fade-in min-h-12 flex items-center justify-center w-full gap-1 pl-2 pointer-events-none">
								<DownloadIcon className="min-h-4 min-w-4" />
								<Label className=" w-fit max-w-72 pr-2 pointer-events-none">{textData.Downloads}</Label>
							</div>
						)
					) : downloadList.length > 0 ? (
						<div
							ref={collapsedRef}
							className="min-h-12 min-w-12 max-w-12 max-h-12 flex items-center justify-center p-1 rounded-lg"
							style={{
								background: "conic-gradient( var(--accent) 0% " + primaryProgress.percent + "%, var(--button) 0% 100%)",
								transition: "minHeight 0.3s, margin-bottom 0.3s, height 0.3s",
							}}
						>
							<Label className=" bg-button zzz-rounded zzz-fg-text text-accent flex items-center justify-center w-full h-full rounded-md pointer-events-none">{`${
								done + downloads.downloading.length
							}/${downloadList.length}`}</Label>
						</div>
					) : (
						<div className="min-h-12 min-w-12 flex items-center justify-center rounded-md">
							<DownloadIcon className="min-h-4 min-w-4" />
						</div>
					)}
				</Button>
			</DialogTrigger>
			<DialogContent className="min-w-180 min-h-150">
				<div className="min-h-fit text-accent my-6 text-3xl">{textData.Downloads}</div>
				<div className="h-116 flex flex-col items-center w-full gap-4 p-0">
					<div className="flex justify-between w-full">
						<div className="text-accent text-lg">{`${textData._LeftSideBar._components._Downloads.Queue} (${downloadList.length})`}</div>
						<Button
							variant="outline"
							size="sm"
							onClick={clearCompleted}
							style={{ backgroundColor: "#0000" }}
							disabled={!downloadList.some((item) => item.status === "completed" || item.status === "failed")}
						>
							{textData._LeftSideBar._components._Downloads.Clear}
						</Button>
					</div>
					<div className="data-wuwa:gap-0 data-wuwa:border flex flex-col w-full h-full gap-2 overflow-y-auto text-gray-300 border-0 rounded-sm">
						{downloadList.length > 0 ? (
							downloadList.map((item, index) => (
								<div
									key={(item.key || item.name).replaceAll("DISABLED_", "") + index}
									className="hover:bg-background/20 zzz-fg-text data-gi:border-1 data-gi:rounded-sm min-h-16 data-wuwa:border-b button-like relative flex items-center justify-between w-full px-4 overflow-hidden"
									style={{ backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150" }}
								>
									{item.status === "downloading" && (
										<div
											ref={(ele) => {
												if (item.key) rowRefs.current[item.key] = ele;
											}}
											className="bg-accent bgaccent pointer-events-none absolute top-0 left-0 h-full opacity-30"
											style={{ width: getProgress(item.key).percent + "%" }}
										></div>
									)}
									<div className=" flex items-center flex-1 w-full gap-3 z-10">
										{Icons[item.status as keyof typeof Icons] || <FileQuestionIcon className="min-h-4 min-w-4" />}
										<div className="flex flex-col flex-1 w-full">
											<Label
												className="focus:border-0 border-border/0 max-w-142 text-ellipsis w-full h-8 overflow-hidden text-white rounded-none cursor-default pointer-events-none"
												style={{ backgroundColor: "#fff0" }}
											>
												{item.name.replaceAll("DISABLED_", "")}
											</Label>
											<div className="flex gap-1 text-xs text-gray-400 capitalize">
												{`${item.status + (item.status === "extracting" ? ` ${item.fname}` : "")}`}
												<div
													ref={(ele) => {
														if (item.key) speedRefs.current[item.key] = ele;
													}}
												>
													{item.status === "failed"
														? ` • ${item.error || "failed"} • `
														: item.status === "downloading"
															? getProgress(item.key).text
															: " • "}
												</div>
												{item.category}
											</div>
										</div>
									</div>
									<div className="flex items-center gap-2 z-20">
										{item.status === "pending" ||
										item.status === "completed" ||
										item.status === "failed" ||
										item.status === "downloading" ? (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => cancelDownload(index)}
												className={
													item.status === "completed" || item.status === "failed"
														? "hover:text-gray-300 data-zzz:border-0 text-gray-400"
														: "hover:text-destructive"
												}
											>
												<X className="w-4 h-4" />
											</Button>
										) : item.status === "extracting" ? (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => cancelExtract(item.key || "")}
												className="hover:text-destructive"
											>
												<X className="w-4 h-4" />
											</Button>
										) : null}
									</div>
								</div>
							))
						) : (
							<div className="flex items-center justify-center h-full text-gray-400">
								{textData._LeftSideBar._components._Downloads.NoQ}
							</div>
						)}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
export default Downloads;

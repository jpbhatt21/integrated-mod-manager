import { Input } from "@/components/ui/input";
import {
	CATEGORIES,
	DATA,
	GAME,
	INIT_DONE,
	LAST_UPDATED,
	MOD_LIST,
	ONLINE,
	openConflict,
	SELECTED,
	SOURCE,
	TEXT_DATA,
} from "@/utils/vars";
import { confirmAndCancelDownloadsForGameSwitch } from "@/utils/downloadManager";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
	ArrowUpRightFromSquareIcon,
	CheckIcon,
	ChevronDownIcon,
	DownloadIcon,
	EyeIcon,
	HeartIcon,
	LinkIcon,
	MinusIcon,
	SearchIcon,
	Settings2Icon,
	SwordsIcon,
	TrashIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { openPath } from "@tauri-apps/plugin-opener";
import { GAME_GB_IDS, GAMES, managedSRC } from "@/utils/consts";
import { getImageUrl, handleImageError, handleInAppLink, join } from "@/utils/utils";
import { toFs } from "@/utils/pathsep";
import { Sidebar, SidebarContent, SidebarGroup } from "@/components/ui/sidebar";
// @ts-ignore: no type declarations available for this optional Tauri plugin
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
	changeModName,
	deleteMod,
	getModDetails,
	installFromArchives,
	refreshModList,
	saveConfigs,
	selectPath,
} from "@/utils/filesys";
import { Label } from "@/components/ui/label";
import { Games, Mod, ModDataObj } from "@/utils/types";
import ManageCategories from "./components/ManageCategories";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { vkToDisplay } from "@/utils/hotkeyUtils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatePresence, motion } from "motion/react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { addToast } from "@/_Toaster/ToastProvider";
import ModPreferences from "./components/ModPreferences";
import { info } from "@/lib/logger";
import ModPreviewCrop from "./components/ModPreviewCrop";
import ModPreview from "./components/ModPreview";
import { savePreviewImageFromData } from "@/utils/filesys";
import { useDropzone } from "react-dropzone";

let text = "";
let curUrlIndex = 0;
let cachcedDetails: any = {};
const timeKey = Date.now().toString();
function RightLocal() {
	const [tab, setTab] = useState<"notes" | "hotkeys">("hotkeys");
	const setOnline = useSetAtom(ONLINE);
	const game = useAtomValue(GAME);
	const initDone = useAtomValue(INIT_DONE);
	// const setSettings = useSetAtom(SETTINGS);

	const [urls, setUrls] = useState<string[]>([]);
	const handleURLGame = useCallback(
		async (urls: string[]) => {
			const final = urls[urls.length - 1];
			if (final) getCurrentWebviewWindow()?.setFocus();
			if (final.includes("/game/")) {
				const url: any = final.split("/game/");
				url[1] = url[1].split("/");
				const urlGame = GAME_GB_IDS[url[1].shift()];
				info(`urlGame: ${urlGame} game: ${game}`);
				url[1] = url[1].join("/");
				urls[urls.length - 1] = url.join("/");
				if (urlGame && urlGame != game) {
					if (!(await confirmAndCancelDownloadsForGameSwitch())) return;
					addToast({
						message: textData.SwitchGame.replace("<game/>", urlGame),
					});
					sessionStorage.setItem("imm-deep-link-game", urlGame);
					console.log("Setting deep link game in sessionStorage:", urls[urls.length - 1]);
					sessionStorage.setItem("imm-session-timestamp", timeKey);
					sessionStorage.setItem("imm-deep-link-url", urls[urls.length - 1]);
					window.location.reload();
				} else {
					throw new Error("Invalid game in URL or same as current game.");
				}
			} else if (final.includes("/mode/")) {
				const urlGame = final.split("/mode/")[1].split("/")[0].toUpperCase();
				if (urlGame && urlGame != game && GAMES.includes(urlGame as Games)) {
					if (!(await confirmAndCancelDownloadsForGameSwitch())) return;
					sessionStorage.setItem("imm-deep-link-game", urlGame);
					window.location.reload();
				} else {
					throw new Error("Invalid game in URL or same as current game.");
				}
			} else {
				throw new Error("URL does not contain a game or mode parameter.");
			}
		},
		[game]
	);
	useEffect(() => {
		if (!game) {
			return () => {};
		}
		let unlisten: (() => void) | undefined;

		const initDeepLink = async () => {
			// 1. Check if app was launched via deep link
			// We use sessionStorage to ensure we only process the launch URL once per session.
			// This prevents the deep link from re-triggering on page reload (F5),
			// as the CLI args (returned by getCurrent) persist for the process lifetime.
			const initialUrls = await getCurrent();
			const isDeepLinkHandled = sessionStorage.getItem("deep-link-initial-handled");
			console.log("Initial URLs:", initialUrls, "Handled:", isDeepLinkHandled);
			if (initialUrls && !isDeepLinkHandled) {
				info("Launched with URLs:", initialUrls);
				sessionStorage.setItem("deep-link-initial-handled", "true");
				await handleURLGame(initialUrls).catch(() => {
					setUrls((prev) => [...prev, ...initialUrls]);
				});
			}
			// 2. Listen for deep links while app is running
			// The single-instance plugin forwards Windows deep links here automatically
			unlisten = await onOpenUrl(async (newUrls) => {
				info("Received new URLs:", newUrls);
				await handleURLGame(newUrls).catch(() => {
					setUrls((prev) => [...prev, ...newUrls]);
				});
			});
		};

		initDeepLink();

		return () => {
			if (unlisten) unlisten();
		};
	}, [handleURLGame, game]);
	useEffect(() => {
		if (!initDone) return;
		console.log("Checking URLs after init:", sessionStorage.getItem("imm-deep-link-url"), urls);
		if (sessionStorage.getItem("imm-deep-link-url") && timeKey != sessionStorage.getItem("imm-session-timestamp")) {
			const url = sessionStorage.getItem("imm-deep-link-url")!;
			info("Processing pending deep link URL from sessionStorage:", url);
			handleInAppLink(url);
			sessionStorage.removeItem("imm-deep-link-url");
			return;
		}
		if (urls.length === 0 || curUrlIndex >= urls.length) return;
		info("Processing URLs after init:", urls);
		handleInAppLink(urls[urls.length - 1]);
		setUrls([]);
	}, [urls, initDone]);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogType, setDialogType] = useState("");
	useEffect(() => {
		if (dialogOpen && dialogType.startsWith("preview")) return () => {};
		const handlePaste = (event: ClipboardEvent) => {
			let activeEl = document.activeElement;
			if (activeEl?.tagName === "BUTTON") activeEl = null;
			if (activeEl === document.body || activeEl === null) {
				let text = event.clipboardData?.getData("Text");
				if (text?.startsWith("http")) {
					event.preventDefault();
					handleInAppLink(text);
				}
			}
		};
		document.addEventListener("paste", handlePaste);
		return () => document.removeEventListener("paste", handlePaste);
	}, [dialogOpen, dialogType]);
	const categories = useAtomValue(CATEGORIES);
	const source = useAtomValue(SOURCE);
	const [deleteItemData, setDeleteItemData] = useState<Mod | null>(null);
	// const decor = useAtomValue(SETTINGS).global.winType
	const [modList, setModList] = useAtom(MOD_LIST);
	const [selected, setSelected] = useAtom(SELECTED);
	const textData = useAtomValue(TEXT_DATA);
	const [data, setData] = useAtom(DATA);
	const [item, setItem] = useState<Mod | undefined>();

	const [alertOpen, setAlertOpen] = useState(false);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [details, setDetails] = useState<any>({});
	const detailsRequestRef = useRef(0);
	useEffect(() => {
		if (!alertOpen) {
			setDeleteItemData(null);
		}
	}, [alertOpen]);
	function manageCategoriesButton({ title = textData.ManageCat }: any) {
		return (
			<Button
				onClick={() => {
					setPopoverOpen(false);
					setDialogType("categories");
					setDialogOpen(true);
				}}
				className="w-full mx-2 my-1"
			>
				<Settings2Icon className="w-4 h-4" />
				{title}
			</Button>
		);
	}
	const [category, setCategory] = useState({ name: "-1", icon: "" });
	const lastUpdated = useAtomValue(LAST_UPDATED);
	const [isPreviewDragActive, setIsPreviewDragActive] = useState(false);
	const onPreviewDrop = useCallback(
		async (acceptedFiles: File[]) => {
			if (!item?.path || acceptedFiles.length === 0) return;
			const file = acceptedFiles[0];
			const extension = file.type.split("/").pop() || "png";
			const data = new Uint8Array(await file.arrayBuffer());
			await savePreviewImageFromData(item.path, extension, data);
			setDialogType("preview-crop");
			setDialogOpen(true);
		},
		[item?.path]
	);
	const { getRootProps: getPreviewRootProps, getInputProps: getPreviewInputProps } = useDropzone({
		onDrop: onPreviewDrop,
		multiple: false,
		accept: { "image/png": [".png"], "image/jpeg": [".jpg", ".jpeg"], "image/gif": [".gif"], "image/webp": [".webp"] },
		noClick: true,
		onDragEnter: () => setIsPreviewDragActive(true),
		onDragLeave: () => setIsPreviewDragActive(false),
		onDropAccepted: () => setIsPreviewDragActive(false),
		onDropRejected: () => setIsPreviewDragActive(false),
	});
	function renameMod(path: string, newPath: string) {
		changeModName(path, newPath)
			.then((newPath) => {
				if (newPath) {
					const name = newPath.split(/[/\\]/).pop();
					name &&
						newPath &&
						setModList((prev) => {
							return prev.map((m) => {
								if (m.path == path) {
									return { ...m, path: newPath, name, parent: newPath.split(/[/\\]/)[0] };
								}
								return m;
							});
						});
					setSelected(newPath);
				}
			})
			.catch(() => {
				addToast({
					message: textData.FailedRename,
					type: "error",
				});
			});
	}
	useEffect(() => {
		text = "";
		if (selected) {
			const mod = modList.find((m) => m.path == selected) as Mod | undefined;
			text = mod?.note || "";
			if (mod) {
				const requestId = ++detailsRequestRef.current;
				const cacheKey = `${mod.path}:${JSON.stringify(data[mod.path]?.vars || {})}`;
				setItem(mod);
				if (cachcedDetails[cacheKey]) {
					setDetails(cachcedDetails[cacheKey]);
				} else {
					setDetails({
						keys: mod.keys || [],
						files: mod.files || {},
					});
				}
				getModDetails(mod.path, mod as any as ModDataObj).then((details) => {
					if (detailsRequestRef.current !== requestId) return;
					const modData = data[mod.path]?.vars;
					if (modData) {
						console.log("Mod data found for mod details:", modData, details);
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
						details = {
							...details,
							keys: details.keys.map(applyModData),
							files: Object.fromEntries(
								Object.entries(details.files).map(([file, keys]) => [
									file,
									(keys as any[]).map((key: any) => applyModData({ ...key, file: key.file || file })).sort((a: any, b: any) => a.target.localeCompare(b.target))
								])
							),
						};
					}
					details.keys = details.keys.sort((a: any, b: any) => a.target.localeCompare(b.target));
					setDetails(details);
					cachcedDetails[cacheKey] = details;
				});
				return;
			}
		}
		detailsRequestRef.current++;
		setItem(undefined);
	}, [selected, modList, data]);
	useEffect(() => {
		if (item) {
			const cat = categories.find((c) => c._sName == item.parent) || { _sName: "-1", _sIconUrl: "" };
			setCategory({ name: cat._sName, icon: cat._sIconUrl });
		} else {
			setCategory({ name: "-1", icon: "" });
		}
	}, [item, modList]);
	const tags = new Set(item?.tags || []);
	//info(item?.keys);
	return (
		<Sidebar side="right" className="pt-8 duration-300">
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				{dialogType == "edit-mod-config" && details ? (
					<ModPreferences item={item} details={details} />
				) : dialogType == "preview-crop" ? (
					<ModPreviewCrop item={item} setDialogType={setDialogType} />
				) : dialogType.startsWith("preview") ? (
					<ModPreview item={item} setDialogType={setDialogType} isBlank={dialogType == "preview-blank"} />
				) : (
					<ManageCategories />
				)}
			</Dialog>
			<AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
				<AlertDialogContent>
					<div className="max-w-96 flex flex-col items-center gap-6 mt-6 text-center">
						<div className="max-w-96 text-xl text-gray-200 wrap-break-words">
							{textData.Delete} <span className="text-accent ">{deleteItemData?.name}</span>?
						</div>
						<div className="text-destructive">{textData.Irrev}</div>
					</div>
					<div className="flex justify-between w-full gap-4 mt-4">
						<AlertDialogCancel variant="default" className="w-24 duration-300">
							{textData.Cancel}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							className=" w-24"
							onClick={async () => {
								if (!deleteItemData) return;
								setData((prev) => {
									const newData = { ...prev };
									if (deleteItemData.path) {
										delete newData[deleteItemData.path];
									}
									return newData;
								});
								deleteMod(deleteItemData.path);
								saveConfigs();
								setModList((prev) => {
									const newData = prev.filter((m) => m.path != deleteItemData.path);
									return newData;
								});
								setAlertOpen(false);
								setSelected("");
							}}
						>
							{textData.Delete}
						</AlertDialogAction>
					</div>
				</AlertDialogContent>
			</AlertDialog>
			<SidebarContent className="bgpattern bg-sidebar flex flex-row w-full h-full gap-0 p-0 overflow-hidden duration-300 border border-t-0">
				<div className=" flex flex-col items-center h-full min-w-full overflow-y-hidden" key={item?.path || "no-item"}>
					<div className="text-accent min-h-10 flex items-center justify-center h-10 min-w-full gap-3 px-3 border-b">
						{item ? (
							<>
								<Button
									className="aspect-square max-h-6"
									onClick={() => {
										openPath(toFs(join(source, managedSRC, item.path)));
									}}
								>
									<ArrowUpRightFromSquareIcon className="max-h-3" />
								</Button>
								<Input
									onFocus={(e) => {
										e.target.select();
									}}
									onBlur={(e) => {
										if (e.currentTarget.value != item.name) {
											renameMod(item.path, join(...item.path.split(/[/\\]/).slice(0, -1), e.currentTarget.value));
										}
									}}
									type="text"
									key={item?.name || "no-item"}
									className="label text-muted-foreground text-ellipsis"
									defaultValue={item?.name || ""}
								/>
								<Button
									className="aspect-square max-h-6"
									variant="destructive"
									onClick={() => {
										setDeleteItemData((prev) => {
											if (prev) return prev;
											setAlertOpen(true);
											return item;
										});
									}}
								>
									<TrashIcon className="max-h-3" />
								</Button>
							</>
						) : (
							"---"
						)}
					</div>
					<SidebarGroup
						{...getPreviewRootProps()}
						className={`min-h-48 max-h-48 overflow-hidden w-82 mt-1 data-zzz:rounded-[0.0625rem] border rounded-lg data-zzz:rounded-tr-2xl data-zzz:rounded-bl-2xl select-nzone relative ${isPreviewDragActive ? "border-accent" : ""}`}
					>
						<input {...getPreviewInputProps()} />
						{/* <EditIcon
							onClick={() => {
								item && savePreviewImage(item.path);
							}}
							className="min-h-8 min-w-8 bg-background/50 z-25 text-accent data-zzz:rounded-bl-2xl rounded-bl-md self-end w-12 p-2 -mb-8 border-l border-b"
						/> */}
						<img
							id="preview-bg"
							className="w-82 h-48 -mb-48 object-cover"
							onError={(e) => handleImageError(e, true)}
							src={`${getImageUrl(item?.path || "")}?${lastUpdated}`}
						></img>
						<img
							id="preview"
							className="w-82 h-48 -mb-48 backdrop-blur-md bg-background/50 object-contain peer"
							onError={(e) => {
								handleImageError(e);
								const next = e.currentTarget.nextElementSibling as HTMLDivElement;
								if (next && item?.path) {
									next.style.opacity = "1";
									let nextChild = next.firstElementChild as HTMLButtonElement;
									if (nextChild) {
										nextChild.innerText = "Set Preview Image";
									}
								}
							}}
							src={`${getImageUrl(item?.path || "")}?${lastUpdated}`}
						></img>
						{item?.path && (
							<div
								key={lastUpdated}
								className="w-82 h-48 flex items-center justify-center text-xs text-accent backdrop-blur-sm bg-background/20 opacity-0 pointer-events-none peer-hover:opacity-100 hover:opacity-100 duration-300"
							>
								<Button
									className="pointer-events-auto"
									onClick={async (e) => {
										const current = e.currentTarget;
										// const parent = current.parentElement as HTMLDivElement;
										if (current.innerText == "Set Preview Image") {
											setDialogType("preview-blank");
											// const success = await savePreviewImage(item.path);
											// if (!success) {
											// 	return;
											// }
											// current.innerText = "Edit Preview Image";
											// parent.style.display = "none";
										} else setDialogType("preview-crop");
										setDialogOpen(true);
									}}
								>
									Edit Preview Image
								</Button>
							</div>
						)}
						{isPreviewDragActive && item?.path && (
							<div className="absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-accent bg-background/70 text-sm text-accent pointer-events-none">
								Drop image to set preview
							</div>
						)}
					</SidebarGroup>
					<SidebarGroup className="px-1 min-h-33.5 my-1">
						<div className="flex flex-col w-full gap-1 py-1 border rounded-lg">
							<div className="bg-pat2 flex items-center justify-between w-full px-1 rounded-lg">
								<Label className=" h-10  flex items-center justify-center  min-w-28.5 w-28.5 text-accent ">
									{textData.Category}
								</Label>
								{item?.depth == 1 ? (
									<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
										<PopoverTrigger asChild>
											<div
												role="combobox"
												className="overflow-hidden text-ellipsis active:scale-90 whitespace-nowrap rounded-md text-sm font-medium transition-all p-2 gap-2 bg-sidebar text-accent shadow-xs hover:brightness-120  duration-300 h-10 flex items-center justify-between w-48.5"
											>
												{category.name != "-1" ? (
													<>
														{" "}
														{category.name != "Uncategorized" && (
															<img
																className=" aspect-square scale-120 outline bg-accent/10 items-center justify-center h-full text-white rounded-full pointer-events-none"
																onError={(e) => {
																	e.currentTarget.src = "/who.jpg";
																}}
																src={category.icon || "err"}
															/>
														)}
														<div className="w-30 text-ellipsis overflow-hidden break-words pointer-events-none">
															{category.name}
														</div>
													</>
												) : (
													textData.Select
												)}
												<ChevronDownIcon />
											</div>
										</PopoverTrigger>
										<PopoverContent className="w-80 p-0 my-2 mr-2 border rounded-lg">
											<Command>
												<CommandInput placeholder={textData.Search} className="h-12" />
												<CommandList>
													<CommandEmpty>{textData.NoCat}</CommandEmpty>
													<CommandGroup>
														{categories.map((cat) => (
															<CommandItem
																key={cat._sName}
																value={cat._sName}
																onSelect={(currentValue) => {
																	renameMod(item.path, join(currentValue, item.name));
																	setPopoverOpen(false);
																}}
																className="button-like zzz-fg-text data-zzz:mt-1"
															>
																<img
																	className="aspect-square outline bg-accent/10 flex items-center justify-center h-12 text-white rounded-full pointer-events-none"
																	onError={(e) => {
																		e.currentTarget.src = "/who.jpg";
																	}}
																	src={cat._sIconUrl || "err"}
																/>

																<div className="w-35 min-w-fit text-ellipsis overflow-hidden break-words">
																	{cat._sName}
																</div>
																<CheckIcon
																	className={cn("ml-auto", category.name === cat._sName ? "opacity-100" : "opacity-0")}
																/>
															</CommandItem>
														))}
													</CommandGroup>
												</CommandList>
											</Command>
										</PopoverContent>
									</Popover>
								) : (
									<div className="w-48.5 flex items-center pr-2">
										{manageCategoriesButton({ title: textData.Manage })}
									</div>
								)}
							</div>
							<div className="bg-pat1 flex justify-between w-full px-1 rounded-lg">
								<Label className="bg-input/0 flex items-center justify-center hover:bg-input/0 h-10 w-28.5 text-accent ">
									{textData.Source}
								</Label>
								<div className="w-48.5 flex items-center px-1">
									<Input
										onBlur={(e) => {
											if (item && e.currentTarget.value !== item?.source) {
												setData((prev) => {
													prev[item.path] = {
														...prev[item.path],
														source: e.currentTarget.value,
														updatedAt: Date.now(),
														viewedAt: 0,
													};
													if (!prev[item.path].source) {
														delete prev[item.path].source;
													}
													return { ...prev };
												});
												setModList((prev) => {
													return prev.map((m) => {
														if (m.path == item.path) {
															return { ...m, source: e.currentTarget.value };
														}
														return m;
													});
												});
												saveConfigs();
											}
										}}
										type="text"
										placeholder={textData.NoSource}
										className="w-full select-none focus-within:select-auto overflow-hidden h-10 focus-visible:ring-[0px] border-0  text-ellipsis"
										style={{ backgroundColor: "#fff0" }}
										key={item?.source}
										defaultValue={item?.source}
									/>
									{item?.source ? (
										<Button
											className="bg-pat2"
											onClick={() => {
												if (item?.source && item?.source != "") {
													handleInAppLink(item.source || "");
												}
											}}
										>
											<Tooltip>
												<TooltipTrigger>
													<LinkIcon className=" w-4 h-4" />
												</TooltipTrigger>
												<TooltipContent className="flex items-center justify-center w-20">
													<p className="max-w-20 w-full text-center">
														{textData.ViewModOnline}
													</p>
												</TooltipContent>
											</Tooltip>
										</Button>
									) : (
										item && (
											<Button
												onClick={() => {
													setOnline(true);
													const search = document.getElementById("search-input") as HTMLInputElement;
													setTimeout(() => {
														search.focus();
														search.value = item?.name.replaceAll("_", " ");
														search.blur();
													}, 100);
													// setRightSlideOverOpen(true);
													setSelected("");
												}}
												className="bg-pat2"
											>
												<Tooltip>
													<TooltipTrigger>
														<SearchIcon className=" w-4 h-4 pointer-events-none" />
													</TooltipTrigger>
													<TooltipContent className="w-15 flex items-center justify-center">
														<p className="max-w-15 w-full text-center">
															{textData.SearchOnline}
														</p>
													</TooltipContent>
												</Tooltip>
											</Button>
										)
									)}
									{}
								</div>
							</div>
							<div className="bg-pat1 flex justify-between w-full px-1 rounded-lg">
								<Label className="bg-input/0 flex items-center justify-center hover:bg-input/0 h-10 w-28.5 text-accent ">
									{textData.Tags}
								</Label>
								<div className="w-48.5 flex gap-1 justify-evenly items-center px-1">
									<Tooltip>
										<TooltipTrigger>
											<Button
												onClick={() => {
													if (!item) return;
													const newTags = new Set(item.tags || []);
													if (newTags.has("fav")) {
														newTags.delete("fav");
													} else {
														newTags.add("fav");
													}
													setData((prev) => {
														prev[item.path] = {
															...prev[item.path],
															tags: Array.from(newTags),
														};
														return { ...prev };
													});
													setModList((prev) => {
														return prev.map((m) => {
															if (m.path == item.path) {
																return { ...m, tags: Array.from(newTags) };
															}
															return m;
														});
													});
													saveConfigs();
												}}
												className="aspect-square h-8"
											>
												<HeartIcon
													className="w-3.5 h-3.5 "
													style={{
														color: tags.has("fav") ? "var(--color-red-400)" : "",
														fill: tags.has("fav") ? "currentColor" : "none",
													}}
												/>
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											{new Set(item?.tags || []).has("fav") ? textData.RemFav : textData.AddFav}
										</TooltipContent>
									</Tooltip>
									<Tooltip>
										<TooltipTrigger>
											<Button
												onClick={() => {
													if (!item) return;
													const newTags = new Set(item.tags || []);
													if (newTags.has("nsfw")) {
														newTags.delete("nsfw");
													} else {
														newTags.add("nsfw");
													}
													setData((prev) => {
														prev[item.path] = {
															...prev[item.path],
															tags: Array.from(newTags),
														};
														return { ...prev };
													});
													setModList((prev) => {
														return prev.map((m) => {
															if (m.path == item.path) {
																return { ...m, tags: Array.from(newTags) };
															}
															return m;
														});
													});
													saveConfigs();
												}}
												className="aspect-square flex flex-col h-8"
												style={{
													color: tags.has("nsfw") ? "var(--color-yellow-200)" : "",
												}}
											>
												<EyeIcon className="w-3.5 h-3.5 " />
												<MinusIcon
													className="scale-x-170 -mt-6 duration-300 rotate-45"
													style={{
														scale: tags.has("nsfw") ? "1.7 1" : "0 1",
													}}
												/>
											</Button>
										</TooltipTrigger>
										<TooltipContent>
											{new Set(item?.tags || []).has("nsfw") ? textData.UnmarkNSFW : textData.MarkNSFW}
										</TooltipContent>
									</Tooltip>
								</div>
							</div>
						</div>
					</SidebarGroup>
					<SidebarGroup
						className="h-full duration-200 opacity-0"
						style={{
							opacity: item ? 1 : 0,
							marginBottom: item ? "0rem" : "-27.5rem",
						}}
					>
						<div className=" flex flex-col w-full h-full p-2 overflow-hidden">
							<Tabs defaultValue={tab} onValueChange={(val: any) => setTab(val)} className=" w-full min-h-full">
								<TabsList className="bg-background/0 w-full h-8 gap-2">
									<TabsTrigger
										value="hotkeys"
										nbg2
										className="transparent-bg w-1/2 h-8"
										style={{
											color: tab == "hotkeys" ? "var(--accent)" : "var(--muted-foreground)",
											border: "0.0625rem solid var(--border)",
											opacity: tab == "hotkeys" ? 1 : 0.4,
										}}
									>
										{textData.HotKeys}
									</TabsTrigger>
									<TabsTrigger
										nbg2
										value="notes"
										className="transparent-bg w-1/2 h-8"
										style={{
											color: tab !== "hotkeys" ? "var(--accent)" : "var(--muted-foreground)",
											border: "0.0625rem solid var(--border)",
											opacity: tab !== "hotkeys" ? 1 : 0.4,
										}}
									>
										{textData.Notes}
									</TabsTrigger>
								</TabsList>
								<AnimatePresence mode="wait" initial={false}>
									<motion.div
										key={tab + item?.note}
										initial={{ opacity: 0, x: tab == "hotkeys" ? "-25%" : "25%" }}
										animate={{ opacity: 1, x: 0 }}
										exit={{ opacity: 0, x: tab == "hotkeys" ? "-25%" : "25%" }}
										transition={{ duration: 0.2 }}
										className="flex w-full h-full gap-2 border rounded-md"
									>
										{tab == "hotkeys" ? (
											<div className="text-gray-300 h-full max-h-[calc(100vh-32.75rem)] flex flex-col w-full overflow-y-scroll overflow-x-hidden">
												{item &&
													details?.keys?.map((hotkey: any, index: number) => (
														<div
															key={index + item.path}
															className={
																"flex border-b justify-center text-border items-center gap-2 w-full min-h-10 px-4 py-2 bg-pat" +
																(1 + (index % 2))
															}
														>
															<label className="min-w-1/3 max-w-1/3 text-accent flex-1 text-sm truncate">
																{hotkey.name}
															</label>
															|
															<div className=" flex items-center w-2/3 gap-1">
																{vkToDisplay(hotkey.key as string)
																	.split(" ﹢ ")
																	.map((key, i, arr) => (
																		<span key={i} className="flex items-center">
																			<kbd className="text-accent bg-sidebar border-border min-w-8 px-2 py-1 text-sm font-semibold text-center border rounded-md shadow-sm">
																				{key}
																			</kbd>
																			{i < arr.length - 1 && (
																				<span className="text-muted-foreground mx-1 text-xs">+</span>
																			)}
																		</span>
																	))}
															</div>
														</div>
													))}
											</div>
										) : (
											<div className="w-full h-full p-2">
												<textarea
													onBlur={(e) => {
														text = e.currentTarget.value;
														if (item && e.currentTarget.value !== item?.note) {
															setData((prev) => {
																prev[item.path] = {
																	...prev[item.path],
																	note: e.currentTarget.value,
																};
																return { ...prev };
															});
															setModList((prev) => {
																return prev.map((m) => {
																	if (m.path == item.path) {
																		return { ...m, note: e.currentTarget.value };
																	}
																	return m;
																});
															});
															saveConfigs();
														}
													}}
													className="w-full focus-within:outline-0 resize-none  select-none focus-within:select-auto overflow-y-scroll h-full  focus-visible:ring-[0px] border-0  text-ellipsis"
													style={{ backgroundColor: "#fff0" }}
													key={item?.note}
													placeholder={textData.NoNotes}
													defaultValue={text}
												/>
											</div>
										)}
									</motion.div>
								</AnimatePresence>
							</Tabs>
						</div>
					</SidebarGroup>
					<SidebarGroup
						className="min-h-10 p-2 pt-0 mb-2 overflow-hidden"
						style={{
							maxHeight: item ? "2.5rem" : "",
						}}
					>
						{item && (
							<Button
								className="w-full h-10"
								onClick={() => {
									setDialogType("edit-mod-config");
									setDialogOpen(true);
								}}
							>
								<Settings2Icon className="w-4 h-4" />
								{textData.EditConf}
							</Button>
						)}

						<div className="w-full -mb-2 pointer-events-auto justify-between flex">
							<Button
								className="w-38.75 h-12"
								onClick={async () => {
									const files = (await selectPath({
										multiple: true,
										title: "Select .7z/.zip/.rar Archive(s) to Install Mod(s) From",
									})) as string[] | null;
									if (!files || files.length === 0) return;
									installFromArchives(files || ([] as string[])).then(async () => {
										setModList(await refreshModList());
									});
								}}
							>
								<DownloadIcon className="w-4 h-4" />
								{textData.ManualInstall}
							</Button>
							<Button
								className="w-38.75 h-12"
								variant="destructive"
								onClick={() => {
									openConflict();
								}}
							>
								<SwordsIcon className="w-4 h-4" />
								{textData.Conflicts}
							</Button>
						</div>
					</SidebarGroup>
				</div>
			</SidebarContent>
		</Sidebar>
	);
}

export default RightLocal;

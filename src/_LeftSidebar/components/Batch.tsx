import { addToast } from "@/_Toaster/ToastProvider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { managedSRC, managedTGT, RESTORE, UNCATEGORIZED } from "@/utils/consts";
import {
	addToBatchPreview,
	changeModName,
	folderSelector,
	refreshModList,
	saveConfigs,
	sourceBatchPreview,
	toggleMod,
} from "@/utils/filesys";
import { join } from "@/utils/hotreload";
import { toFs } from "@/utils/pathsep";
import { setCategories } from "@/utils/init";
import { CATEGORIES, MOD_LIST, SETTINGS, SOURCE, TARGET, TEXT_DATA } from "@/utils/vars";
import { remove, rename } from "@/utils/fs";
import { openPath } from "@tauri-apps/plugin-opener";
import { useAtomValue, useSetAtom } from "jotai";
import {
	CheckIcon,
	ChevronRightIcon,
	FileIcon,
	FolderCogIcon,
	FolderIcon,
	FolderInputIcon,
	GroupIcon,
	Maximize2Icon,
	Minimize2Icon,
	RefreshCwIcon,
	Settings2Icon,
	TrashIcon,
	XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { JSX, useCallback, useEffect, useMemo, useState } from "react";
import { error, info } from "@/lib/logger";
import { cn } from "@/lib/utils.ts";

type BatchNode = {
	children?: BatchNode[];
	depth: number;
	icon?: string;
	isDir: boolean;
	name: string;
	parent: string;
	path: string;
	isSkeleton?: boolean;
};
function editChild(name: string, parent: string[], treeData: BatchNode[], children: BatchNode[]): BatchNode[] {
	return treeData
		? treeData.map((node) => {
				if (node.name === name && node.parent === join(...parent)) {
					return {
						...node,
						children,
					};
				} else if (node.children) {
					return { ...node, children: editChild(name, parent, node.children, children) };
				}
				return node;
		  })
		: [];
}
function getChildrenAtPath(nodes: BatchNode[], indexPath: number[]): BatchNode[] {
	if (indexPath.length === 0) return nodes;
	let currentNodes = nodes;
	let current: BatchNode | undefined;
	for (const idx of indexPath) {
		current = currentNodes[idx];
		if (!current) return [];
		currentNodes = current.children || [];
	}
	return current?.children || [];
}
function normalizeManagedMods(targets: string[], tree: BatchNode[], categories: any[]): string[] {
	const normalized: Set<string> = new Set();
	categories = [...categories.map((cat) => cat._sName), UNCATEGORIZED];
	if (!targets.includes(managedSRC)) {
		categories = targets.filter((t) => t.split(/[/\\]/).length == 2).map((t) => t.split(/[/\\]/)[1]);
		targets.forEach((t) => {
			if (t.split(/[/\\]/).length == 3) normalized.add(t);
		});
		// info(cats,mods);
	}
	function handleCategories(category: BatchNode) {
		// const isValid = categories.some((cat) => cat === category.name) ;
		if (categories.includes(category.name) && category.name !== RESTORE) {
			category.children?.forEach((mod) => {
				normalized.add(mod.path);
			});
		}
	}
	// info("Categories:",categories);
	tree.forEach((node) => {
		if (node.name === managedSRC) {
			node.children?.forEach((category) => {
				handleCategories(category);
			});
		}
	});
	// info("Normalized:", normalized);
	return Array.from(normalized.keys()) || [];
}
function toManagedRelPath(path: string) {
	return path.replace(managedSRC + "/", "").replace(managedSRC + "\\", "");
}
let prevSelectedIndices = [] as number[];
let prevState = false;

function BatchOperations({ leftSidebarOpen }: { leftSidebarOpen: boolean }) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [refresh, setRefresh] = useState(0);
	const [alertOpen, setAlertOpen] = useState(false);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const  setSettings = useSetAtom(SETTINGS);
	const textData = useAtomValue(TEXT_DATA);
	const [treeData, setTreeData] = useState<BatchNode[]>([]);
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const [checked, setChecked] = useState<Set<string>>(new Set());
	const [shiftDown, setShiftDown] = useState<boolean>(false);
	const setModList = useSetAtom(MOD_LIST);
	const [curSelectedIndices, setCurSelectedIndices] = useState<number[]>([]);
	const [isMaximized, setIsMaximized] = useState<boolean>(false);
	const [newCategory, setNewCategory] = useState<string>("");
	const source = useAtomValue(SOURCE);
	const target = useAtomValue(TARGET);
	const categories = useAtomValue(CATEGORIES);
	useEffect(() => {
		if (checked.size === 0 && curSelectedIndices.length > 0) {
			setCurSelectedIndices([]);
			prevSelectedIndices = [];
		} else {
			if (shiftDown && prevSelectedIndices.length > 0 && curSelectedIndices.length > 0) {
				const prevPath = [...prevSelectedIndices];
				const curPath = [...curSelectedIndices];
				const maxPrefix = Math.min(prevPath.length, curPath.length);
				let prefixLen = 0;
				while (prefixLen < maxPrefix && prevPath[prefixLen] === curPath[prefixLen]) {
					prefixLen++;
				}
				const common = prevPath.slice(0, prefixLen);
				const prevRemainder = prevPath.slice(prefixLen);
				const curRemainder = curPath.slice(prefixLen);
				const sameDepth = prevRemainder.length === curRemainder.length;
				if (sameDepth && prevRemainder.length === 1 && curRemainder.length === 1) {
					const siblings = getChildrenAtPath(treeData, common);
					if (siblings.length > 0) {
						const startIndex = Math.min(prevRemainder[0], curRemainder[0]);
						const endIndex = Math.max(prevRemainder[0], curRemainder[0]);
						const newChecked = new Set(checked);
						let changed = false;
						for (let i = startIndex; i <= endIndex; i++) {
							const node = siblings[i];
							if (!node) continue;
							if (!newChecked.has(node.path)) {
								newChecked.add(node.path);
								changed = true;
							}
						}
						if (changed) {
							setChecked(newChecked);
						}
					}
				}
				prevSelectedIndices = [...curPath];
			} else {
				prevSelectedIndices = [...curSelectedIndices];
			}
		}
	}, [checked, curSelectedIndices, shiftDown, treeData]);
	useEffect(() => {
		if (!dialogOpen) {
			if(!prevState){
				prevState = false;
				return;
			}
			addToast({
				type: "info",
				message: textData.RefreshMods,
			});
			setChecked(new Set());
			setCurSelectedIndices([]);
			prevSelectedIndices = [];
			setExpanded(new Set());
			setTreeData([]);
			refreshModList().then((data) => {
				setModList(data);
			});
			prevState = false;
			return;
		}
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Shift") {
				setShiftDown(true);
				event.preventDefault();
			}
		};
		const handleKeyUp = (event: KeyboardEvent) => {
			if (event.key === "Shift") {
				setShiftDown(false);
				event.preventDefault();
			}
		};
		let cancelled = false;
		const loadTree = async () => {
			try {
				const entries = (await sourceBatchPreview()) as BatchNode[] | undefined;
				if (!cancelled && entries) {
					setTreeData([...entries]);
					setExpanded(new Set(entries.filter((entry) => entry.path === managedSRC).map((entry) => entry.path)));
				}
			} catch (err) {
				error("[IMM] Error loading batch preview tree:", err);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		window.addEventListener("keyup", handleKeyUp);
		loadTree();
		prevState = true;
		return () => {
			cancelled = true;
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("keyup", handleKeyUp);
		};
	}, [dialogOpen, refresh]);
	function toggleSelectedMods(enable: boolean) {
		const promises = normalizeManagedMods(cleanChecked, treeData, categories).map((modPath) => {
			return toggleMod(toManagedRelPath(modPath), enable);
		});
		Promise.all(promises).then(() => {
			addToast({
				type: "success",
				message: textData.ApplyingChanges,
			});
		});
	}
	const expand = useCallback(
		(item: any) => {
			const newExpanded = new Set(expanded);
			if (expanded.has(item.path) || item.path === managedTGT) {
				newExpanded.delete(item.path);
			} else {
				if (item.children && item.children.length === 0) {
					const path = item.path.split(/[/\\]/).slice(0, -1);
					setTreeData((prev) => {
						return [
							...editChild(item.name, path, prev, [
								{
									depth: item.depth + 1,
									isDir: false,
									name: textData.EmptyFolder,
									parent: item.path,
									path: join(item.path, "Loading..."),
									isSkeleton: true,
								},
							]),
						];
					});
					addToBatchPreview(item.path).then((children) => {
						// setTimeout(() => {
						setTreeData((prev) => {
							return [...editChild(item.name, path, prev, children)];
						});
						// }, 100);
					});
				}
				if (checked.has(item.path))
					addToast({
						type: "warning",
						message: textData.CannotExpandSelected,
					});
				else newExpanded.add(item.path);
			}
			setExpanded(newExpanded);
		},
		[expanded, checked]
	);
	const cleanChecked = useMemo(() => {
		return Array.from(checked).filter((path) => {
			let isRedundant = false;
			checked.forEach((otherPath) => {
				if (otherPath !== path && (path.startsWith(otherPath + "/") || path.startsWith(otherPath + "\\"))) {
					isRedundant = true;
				}
			});
			return !isRedundant;
		});
	}, [checked]);

	const toggleValid = useMemo(() => {
		return (
			cleanChecked.filter((path) => path.startsWith(managedSRC) && path.split(/[/\\]/).length <= 3).length ==
				cleanChecked.length && cleanChecked.length > 0
		);
	}, [cleanChecked, treeData]);
	const moveValid = useMemo(() => {
		// info(cleanChecked.filter((path) => path.startsWith(managedSRC) && path.split(/[/\\]/).length == 3).length, cleanChecked.filter((path)  => !path.startsWith(managedSRC) && path.split(/[/\\]/).length == 1).length, cleanChecked.length );
		return (
			cleanChecked.filter((path) => path.startsWith(managedSRC) && path.split(/[/\\]/).length == 3).length +
				cleanChecked.filter((path) => !path.startsWith(managedSRC) && path.split(/[/\\]/).length < 3).length ==
				cleanChecked.length && cleanChecked.length > 0
		);
	}, [cleanChecked, treeData]);
	const deleteValid = useMemo(() => {
		return !(cleanChecked.includes(managedSRC) || cleanChecked.length == 0);
	}, [cleanChecked, treeData]);
	const renderChildren = (nodes: BatchNode[], depth = 0, indices: number[] = []): JSX.Element[] => {
		return nodes.map((item, index) => (
			<div
				className={cn('w-full flex select-none pointer-events-auto flex-col', depth > 0 && "border-l")}
				style={{
					backgroundColor: checked.has(item.path)
						? index % 2 == 0
							? `color-mix(in oklab, var(--warn) 20%, ${index % 2 == 0 ? "#1b1b1b50" : "#31313150"})`
							: `color-mix(in oklab, var(--warn) 30%, ${index % 2 == 0 ? "#1b1b1b50" : "#31313150"})`
						: index % 2 == 0
						? "#1b1b1b50"
						: "#31313150",
				}}
			>
				<div
					className={
						"w-full h-10 flex gap-2 items-center pr-2 " +
						(index !== 0 ? "border-t " : "") +
						(index !== nodes.length - 1 || item.children?.length || 0 > 0 ? "border-b" : "")
					}
					onContextMenu={(e) => {
						e.preventDefault();
						expand(item);
					}}
					onClick={(e) => {
						if (e.currentTarget !== e.target || item.path === managedTGT) return;
						const newChecked = new Set(checked);
						if (shiftDown && prevSelectedIndices.length > 0) {
							setCurSelectedIndices([...indices, index]);
							return;
						}
						setCurSelectedIndices([...indices, index]);
						if (newChecked.has(item.path)) {
							newChecked.delete(item.path);
						} else {
							newChecked.add(item.path);
						}
						setChecked(newChecked);
					}}
				>
					{" "}
					{item.isSkeleton ? (
						<div className="min-w-8"></div>
					) : (
						<>
							<ChevronRightIcon
								onClick={() => {
									expand(item);
								}}
								className="min-w-6 w-6 h-4 pl-2 duration-200 cursor-pointer pointer-events-auto"
								style={{
									transform:
										expanded.has(item.path) && !checked.has(item.path)
											? "rotate(90deg) translateX(-0.3125rem) translateY(-0.125rem)"
											: "",
									opacity: item.path === managedTGT ? 0.25 : item.isDir ? 1 : 0,
								}}
							/>
							<Checkbox
								disabled={item.path === managedTGT}
								checked={checked.has(item.path)}
								className="z-20 mr-2 pointer-events-none"
								onCheckedChange={() => {}}
								style={{
									opacity: checked.has(item.path) ? 0.5 : "",
								}}
							/>
							{item.icon ? (
								<img
									src={item.icon}
									onError={(e) => {
										e.currentTarget.src = "/who.jpg";
									}}
									className="min-w-6 w-6 h-6 -ml-1 -mr-1 overflow-hidden rounded-full"
									alt="icon"
								/>
							) : item.name == UNCATEGORIZED ? (
								<FolderCogIcon className="aspect-square w-5 h-5 -mr-1 pointer-events-none" />
							) : item.path === managedSRC ? (
								<label className="text-[0.6rem] min-w-fit px-1 py-0.5 wuwa-font border rounded-full text-success border-success/50 pointer-events-none">
									{textData.BatchSource}
								</label>
							) : item.path === managedTGT && source === target ? (
								<label className="text-[0.6rem] min-w-fit flex items-center px-1 py-0.5 wuwa-font border rounded-full text-warn border-warn/50 pointer-events-none">
									{textData.Target}
								</label>
							) : item.isDir ? (
								<FolderIcon className="w-4 h-4" />
							) : (
								<FileIcon className="w-4 h-4" />
							)}
						</>
					)}
					<Label className={"w-full pointer-events-none " + ((index % 2) + 1)}>{item.name}</Label>
					{item.path === managedTGT ? (
						<label className="text-destructive min-w-fit text-xs opacity-50">
							{textData.CannotModify}
						</label>
					) : (
						<></>
					)}
				</div>
				<AnimatePresence>
					{expanded.has(item.path) && !checked.has(item.path) && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							key={item.children?.length}
							className="flex1 flex-col items-center w-full pl-6"
						>
							{renderChildren(
								item.children && item.children.length > 0
									? item.children
									: [
											{
												depth: item.depth + 1,
												isDir: false,
												name: textData.EmptyFolder,
												parent: item.path,
												path: join(item.path, "Loading..."),
												isSkeleton: true,
											},
									  ],
								depth + 1,
								[...indices, index]
							)}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		));
	};
	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DialogTrigger asChild>
				<Button
					className="w-38.75 text-ellipsis h-12 overflow-hidden"
					style={{ width: leftSidebarOpen ? "" : "3rem", borderRadius: leftSidebarOpen ? "" : "999px" }}
				>
					<GroupIcon />
					{leftSidebarOpen && textData.BatchOps}
				</Button>
			</DialogTrigger>
			<DialogContent
				onFocus={(e) => {
					e.currentTarget.blur();
				}}
				style={{
					maxHeight: "calc( 98vh - 2rem)",
					height: isMaximized ? "calc( 98vh - 2rem)" : "45rem",
					maxWidth: "98vw",
					width: isMaximized ? "98vw" : "",
				}}
				className="duration-300"
			>
				<Tooltip>
					<TooltipTrigger></TooltipTrigger>
					<TooltipContent className="opacity-0"></TooltipContent>
				</Tooltip>
				<AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
					<AlertDialogContent>
						<div className="max-w-96 flex flex-col items-center gap-6 mt-6 text-center">
							<div className="text-xl text-gray-200">
								{textData.Delete} <span className="text-warn ">{cleanChecked.length} item(s)</span>?
							</div>
							<div className="text-destructive">{textData.Irrev}</div>
							<div className="text-destructive">{textData.AllFiles}</div>
						</div>
						<div className="flex justify-between w-full gap-4 mt-4">
							<AlertDialogCancel variant="default" className="w-24 duration-300">
								{textData.Cancel}
							</AlertDialogCancel>
							<AlertDialogAction
								className="text-destructive hover:bg-destructive hover:text-background w-24"
								onClick={async () => {
									if (!deleteValid || cleanChecked.length === 0) return;

									setAlertOpen(false);
									const promises = cleanChecked.map((modPath) => {
										return remove(join(source, modPath), { recursive: true });
									});
									addToast({
										type: "success",
										message: textData.Deleting.replace("<length/>", promises.length.toString()),
									});
									Promise.all(promises).then(() => {
										setChecked(new Set());
										setRefresh((prev) => prev + 1);
										addToast({
											type: "success",
											message: textData.SuccessfullyDeleted.replace("<length/>", promises.length.toString()),
										});
									});
								}}
							>
								{textData.Delete}
							</AlertDialogAction>
						</div>
					</AlertDialogContent>
				</AlertDialog>
				<div
					onClick={() => {
						setIsMaximized((prev) => !prev);
					}}
					className="ring-offset-background data-[state=open]:bg-accent scale-80  data-[state=open]:text-muted-foreground absolute top-4 right-10 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
				>
					{isMaximized ? <Minimize2Icon /> : <Maximize2Icon />}
				</div>
				<div className="min-h-fit text-accent my-6 text-3xl">
					{textData.BatchOperations}
				</div>
				<label className="text-muted min-h-10 z-200 flex items-center gap-1 -mb-4">
					{textData.ContentFrom}
					<label
						onClick={() => {
							openPath(toFs(source));
						}}
						className="hover:opacity-75 text-blue-300 duration-200 opacity-50 pointer-events-auto"
					>
						...{toFs("\\"+source.split("\\").slice(-3).join("\\"))}
					</label>
					<Tooltip>
						<TooltipTrigger
							onClick={() => {
								addToast({
									type: "info",
									message: textData.RefreshMods,
								});
								// setModList([]);
								refreshModList().then((data) => {
									setModList(data);
									setRefresh((prev) => prev + 1);
								});
							}}
						>
							<RefreshCwIcon className="text-link hover:opacity-100 h-4 duration-200 opacity-50"></RefreshCwIcon>
						</TooltipTrigger>
						<TooltipContent>{textData.Refresh}</TooltipContent>
					</Tooltip>
				</label>
				<label className="text-muted min-h-10 z-200 flex items-center justify-between w-full gap-1 -mb-4">
					{textData.ItemsSelected} {cleanChecked.length}
					<label
						onClick={() => {
							setChecked(new Set());
						}}
						className="text-destructive hover:opacity-75 ml-2 text-sm duration-200 opacity-50 pointer-events-auto"
					>
						{textData.DeselectAll}
					</label>
				</label>
				<div
					className="flex flex-col w-full h-full overflow-x-hidden overflow-y-scroll text-gray-300 border rounded-sm"
					style={{
						maxHeight: isMaximized ? "100%" : "24rem",
						height: isMaximized ? "100%" : "24rem",
					}}
				>
					{renderChildren(treeData)}
				</div>
				<div className="w-110 justify-evenly flex flex-wrap items-center gap-2">
					<Button
						disabled={!toggleValid}
						onClick={() => toggleSelectedMods(true)}
						className="w-34.5 active:bg-success/80 group"
					>
						<CheckIcon className="text-success/80 group-active:text-background duration-300" />
						{textData.Enable}
					</Button>
					<Button
						disabled={!deleteValid}
						onClick={() => {
							const selected = [...cleanChecked];
							folderSelector(source, textData.SelectDest).then((dest) => {
								if (!dest) return;
								if (selected.some((modPath) => dest.startsWith(join(source, modPath)))) {
									addToast({
										type: "error",
										message: textData.CannotMove,
									});
									return;
								}
								const promises = selected.map((modPath) => {
									const modName = modPath.split(/[/\\]/).slice(-1)[0];
									const newPath = join(dest, modName);
									return rename(join(source, modPath), newPath);
								});
								addToast({
									type: "success",
									message: textData.Moving.replace("<length/>", selected.length.toString()),
								});
								Promise.all(promises)
									.then(() => {
										setChecked(new Set());
										setRefresh((prev) => prev + 1);
										addToast({
											type: "success",
											message: textData.SuccessfullyMoved.replace("<length/>", selected.length.toString()),
										});
									})
									.catch((e) => {
										if (e.includes("The directory is not empty"))
											addToast({
												type: "error",
												message: textData.SameName,
											});
									});
							});
						}}
						className="w-34.5 "
					>
						<FolderInputIcon className="" />
						{textData.Move}{" "}
					</Button>
					<Button
						disabled={!toggleValid}
						onClick={() => toggleSelectedMods(false)}
						className="w-34.5 active:bg-destructive/80 group"
					>
						<XIcon className="text-destructive/80 group-active:text-background duration-300" />
						{textData.Disable}
					</Button>
					<Button
						disabled={!deleteValid}
						onClick={() => setAlertOpen(true)}
						className="w-41 border-destructive/25 active:border-border active:bg-destructive/80 group"
					>
						<TrashIcon className="text-destructive group-active:text-background duration-300" />
						<label className="text-destructive group-active:text-background duration-300">
							{textData.Delete}
						</label>
					</Button>

					<Popover
						open={popoverOpen}
						onOpenChange={(open) => {
							if (!open) setNewCategory("");
							setPopoverOpen(open);
						}}
					>
						<PopoverTrigger asChild>
							<div
								role="combobox"
								style={{
									pointerEvents: moveValid ? "auto" : "none",
									opacity: moveValid ? "" : 0.5,
								}}
								className="w-41 item border-accent/25 active:border-border text-ellipsis button-like active:text-background active:bg-accent/80 active:scale-90 whitespace-nowrap bg-button text-accent hover:brightness-120 flex items-center justify-center h-10 px-3 py-2 overflow-hidden text-sm font-medium transition-all duration-300 rounded-md shadow-xs pointer-events-auto select-none"
							>
								<Settings2Icon className=" h-5 mr-1" />
								{textData.SetCat}
							</div>
						</PopoverTrigger>
						<PopoverContent className="w-80 z-2000 absolute p-0 mr-2 -mt-12 -translate-x-1/2 -translate-y-full border rounded-lg pointer-events-auto">
							<Command
								onChange={(e: any) => {
									const value = e.target.value.trim();
									if (
										!categories.some((cat) => cat._sName.toLowerCase() === value.toLowerCase()) ||
										value.toLowerCase() === UNCATEGORIZED.toLowerCase() ||
										value.toLowerCase() === RESTORE
									) {
										setNewCategory(value);
									} else {
										setNewCategory("");
									}
								}}
							>
								<CommandList
									onWheel={(e) => {
										// info(e.currentTarget.scrollHeight,  e.currentTarget.scrollTop)
										e.currentTarget.scrollTop += e.deltaY;
									}}
								>
									<CommandEmpty>{textData.NoCat}</CommandEmpty>
									{newCategory && (
										<CommandItem
											itemID="1"
											key={newCategory}
											value={newCategory}
											onSelect={(currentValue) => {
												// renameMod(item.path, join(currentValue, item.name));
												// setNewCategory(currentValue);
												setSettings((prev) => ({
													...prev,
													game: {
														...prev.game,
														customCategories: {
															...(prev.game.customCategories || {}),
															[currentValue]: {
																_sIconUrl: "",
															},
														},
													},
												}));
												saveConfigs();
												setCategories();
												let mods = [...cleanChecked];
												mods = mods.map((modPath) => join(currentValue, modPath.split(/[/\\]/).slice(-1)[0]));
												info('Mods', { mods: mods });
												let promises = mods.map((modPath, index) => {
													info(cleanChecked[index], modPath, !cleanChecked[index].startsWith(managedSRC));
													return changeModName(
														toManagedRelPath(cleanChecked[index]),
														modPath,
														!cleanChecked[index].startsWith(managedSRC)
													);
												});
												addToast({
													type: "success",
													message: textData.Moving.replace("<length/>", mods.length.toString()),
												});
												Promise.all(promises)
													.then(() => {
														setChecked(new Set());
														setRefresh((prev) => prev + 1);
														addToast({
															type: "success",
															message: textData.SuccessfullyMoved.replace("<length/>", mods.length.toString()),
														});
													})
													.catch((e) => {
														if (e.includes("The directory is not empty"))
															addToast({
																type: "error",
																message: textData.SameName,
															});
													});
												setPopoverOpen(false);
											}}
											className="button-like zzz-fg-text data-wuwa:mt-0 mx-1 mt-1"
										>
											<img
												className="aspect-square outline bg-accent/10 flex items-center justify-center h-6 text-white rounded-full pointer-events-none"
												onError={(e) => {
													e.currentTarget.src = "/who.jpg";
												}}
												src={"err"}
											/>

											<div className="w-35 min-w-fit text-ellipsis overflow-hidden break-words">
												{textData.CreateCat} {newCategory}
											</div>
										</CommandItem>
									)}
									<CommandGroup className=" z-20">
										{categories.map((cat) => (
											<CommandItem
												key={cat._sName}
												value={cat._sName}
												onSelect={(currentValue) => {
													// renameMod(item.path, join(currentValue, item.name));
													// setNewCategory(currentValue);
													let mods = [...cleanChecked];
													mods = mods.map((modPath) => join(currentValue, modPath.split(/[/\\]/).slice(-1)[0]));
													info(mods);
													let promises = mods.map((modPath, index) => {
														info(cleanChecked[index], modPath, !cleanChecked[index].startsWith(managedSRC));
														return changeModName(
															toManagedRelPath(cleanChecked[index]),
															modPath,
															!cleanChecked[index].startsWith(managedSRC)
														);
													});
													addToast({
														type: "success",
														message: textData.Moving.replace("<length/>", mods.length.toString()),
													});
													Promise.all(promises).then(() => {
														setChecked(new Set());
														setRefresh((prev) => prev + 1);
														addToast({
															type: "success",
															message: textData.SuccessfullyMoved.replace("<length/>", mods.length.toString()),
														});
													});
													setPopoverOpen(false);
												}}
												className="button-like zzz-fg-text data-zzz:mt-1"
											>
												<img
													className="aspect-square outline bg-accent/10 flex items-center justify-center h-6 text-white rounded-full pointer-events-none"
													onError={(e) => {
														e.currentTarget.src = "/who.jpg";
													}}
													src={cat._sIconUrl || "err"}
												/>

												<div className="w-35 min-w-fit text-ellipsis overflow-hidden break-words">{cat._sName}</div>
											</CommandItem>
										))}
									</CommandGroup>
								</CommandList>
								<CommandInput placeholder={textData.Search} className="h-12" />
							</Command>
						</PopoverContent>
					</Popover>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default BatchOperations;

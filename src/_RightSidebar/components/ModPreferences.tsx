import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openFile, saveConfigs, toggleMod, updateIniVars } from "@/utils/filesys";
import { join, setChange } from "@/utils/hotreload";
import { ModHotKeys } from "@/utils/types";

import { DATA, MOD_LIST, TEXT_DATA } from "@/utils/vars";

import { useAtomValue, useSetAtom } from "jotai";
import {
	ArrowUpRightFromSquareIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	FileIcon,
	InfoIcon,
	IterationCcwIcon,
	MoreVerticalIcon,
	BanIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { info } from "@/lib/logger";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { PopoverTrigger } from "@radix-ui/react-popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import JSONEditor from "@/_Main/components/JSONEditor";
import { encodeToVK, formatKeysToDisplay, sortHotkeys, vkToDisplay } from "@/utils/hotkeyUtils";
import { trackUserAction } from "@/utils/userStats";
let prevItemPath = "";
const pageLimit = 20;
let lastKeyList: string = "";
type QueuedDataChange = {
	type: "pref" | "reset" | "name" | "keyReset";
	file: string;
	target: string;
	value: any;
};
type QueuedIniChange = {
	file: string;
	target: string;
	value: {
		def?: string;
		hk?: string;
	};
};
let keyslist = [] as any[];
let keysdown = [] as any[];
const dataChangeKey = (type: QueuedDataChange["type"], file: string, target: string) => `${type}|${file}|${target}`;
const iniChangeKey = (file: string, target: string) => `${file}|${target}`;
function ModPreferences({ item, details }: { item: any; details: any }) {
	const setData = useSetAtom(DATA);
	const setModList = useSetAtom(MOD_LIST);
	const [keys, setKeys] = useState([] as any);
	const [configMode, setConfigMode] = useState(false);
	const [fileMode, setFileMode] = useState(false);
	const [selectedFile, setSelectedFile] = useState("");
	const [selectedFileData, setSelectedFileData] = useState([] as any);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [pageNo, setPageNo] = useState(0);
	const textData = useAtomValue(TEXT_DATA);
	const textData2 = {
		default: textData.Others.def,
		pref: textData._RightSideBar._components._ModPreferences.Pref,
		expected: textData.Others.exp,
		keys: textData._RightSideBar._RightLocal.HotKeys,
	} as const;
	const columns = Object.keys(textData2) as (keyof typeof textData2)[];
	const [forceKeyUpdate, setForceKeyUpdate] = useState(0);
	const [dataChanges, setDataChanges] = useState<Record<string, QueuedDataChange>>({});
	const [iniChanges, setIniChanges] = useState<Record<string, QueuedIniChange>>({});
	const [applyingChanges, setApplyingChanges] = useState(false);
	const [toggles, setToggles] = useState({
		default: true,
		pref: true,
		expected: true,
		keys: true,
	} as Record<string, boolean>);
	const queuedChangeCount = Object.keys(dataChanges).length + Object.keys(iniChanges).length;
	useEffect(() => {
		if (prevItemPath !== item?.path) {
			setSelectedFile("");
			setPageNo(0);
			setDataChanges({});
			setIniChanges({});
			prevItemPath = item?.path;
		}
	}, [item?.path]);
	useEffect(() => {
		setPageNo(0);
		setSelectedFileData([] as any);
	}, [selectedFile]);
	useEffect(() => {
		let source = (fileMode ? (selectedFileData.length && selectedFileData[pageNo]) || [] : details?.keys) || [];
		const k = {} as any;
		let keyListStr = [] as any;
		source.forEach((keyConfig: ModHotKeys) => {
			if (!keyConfig.default) return;
			if (!k[keyConfig.file]) {
				k[keyConfig.file] = [];
			}
			k[keyConfig.file].push(keyConfig);
			keyListStr.push(`${keyConfig.file}|${keyConfig.target}`);
		});
		setKeys(
			Object.keys(k).map((key) => {
				return { file: key, keys: k[key] };
			})
		);
		keyListStr = keyListStr.join(",");
		if (lastKeyList !== keyListStr) {
			setForceKeyUpdate((prev) => prev + 1);
		}
		lastKeyList = keyListStr;
	}, [details, fileMode, selectedFileData, pageNo]);
	useEffect(() => {
		if (!selectedFile && details?.files && Object.keys(details.files).length == 1) {
			const onlyFile = Object.keys(details.files)[0];
			setSelectedFile(onlyFile);
			return;
		}
		if (fileMode && details?.files && details.files[selectedFile]) {
			const fileData = details.files[selectedFile] || [];
			const pagenatedData = [] as any;
			for (let i = 0; i < fileData.length; i += pageLimit) {
				pagenatedData.push(fileData.slice(i, i + pageLimit));
			}
			setSelectedFileData(pagenatedData);
		}
	}, [details, fileMode, selectedFile]);
	async function refreshMod(path: string) {
		await toggleMod(path, true, true);
		setChange();
	}

	const queueDataChange = useCallback(
		(type: QueuedDataChange["type"], file: string, target: string, value: any, original: any) => {
			console.log("queueDataChange", type, file, target, value, original);
			setDataChanges((prev) => {
				const next = { ...prev };
				const key = dataChangeKey(type, file, target);
				if (value == original || (!value && !original)) delete next[key];
				else next[key] = { type, file, target, value };
				return next;
			});
		},
		[]
	);
	const queueIniChange = useCallback(
		(type: "def" | "hk", file: string, target: string, value: string, original: string) => {
			setIniChanges((prev) => {
				const next = { ...prev };
				const key = iniChangeKey(file, target);
				if (value == original || (!value && !original)) delete next[key];
				else next[key] = { file, target, value: { ...(next[key]?.value || {}), [type]: value } };
				return next;
			});
		},
		[]
	);
	const getDataValue = useCallback(
		(type: QueuedDataChange["type"], file: string, target: string, original: any) =>
			dataChanges[dataChangeKey(type, file, target)]?.value ?? original,
		[dataChanges]
	);
	const getIniValue = useCallback(
		(type: "def" | "hk", file: string, target: string, original: string) =>
			iniChanges[iniChangeKey(file, target)]?.value[type] ?? original,
		[iniChanges]
	);
	const applyQueuedChanges = useCallback(async () => {
		const queuedDataChanges = Object.values(dataChanges);
		const queuedIniChanges = Object.values(iniChanges);
		if (!queuedDataChanges.length && !queuedIniChanges.length) return;

		setApplyingChanges(true);
		try {
			if (queuedDataChanges.length) {
				setData((prev: any) => {
					const next = { ...(prev || {}) };
					for (const change of queuedDataChanges) {
						const itemData = { ...(next[item.path] || {}) };
						const vars = { ...(itemData.vars || {}) };
						const fileVars = { ...(vars[change.file] || {}) };
						const targetVars = { ...(fileVars[change.target] || {}) };
						targetVars[change.type] = change.value;
						if (change.value === null || change.value === undefined || change.value === "") {
							delete targetVars[change.type];
						}
						if (Object.keys(targetVars).length > 0) fileVars[change.target] = targetVars;
						else delete fileVars[change.target];
						if (Object.keys(fileVars).length > 0) vars[change.file] = fileVars;
						else delete vars[change.file];
						if (Object.keys(vars).length > 0) itemData.vars = vars;
						else delete itemData.vars;
						if (Object.keys(itemData).length > 0) next[item.path] = itemData;
						else delete next[item.path];
					}
					return next;
				});
			}

			const iniByFile = queuedIniChanges.reduce(
				(acc, change) => {
					if (!acc[change.file]) acc[change.file] = {};
					acc[change.file][change.target.toLowerCase()] = change.value;
					return acc;
				},
				{} as Record<string, Record<string, { def?: string; hk?: string }>>
			);
			const iniResults = await Promise.all(
				Object.keys(iniByFile).map((file) => {
					info("Updating ini", {
						src: join(item.path, file),
						content: iniByFile[file],
					});
					return updateIniVars(join(item.path, file), iniByFile[file]).then((success) => ({ file, success }));
				})
			);
			const updatedFiles = new Set(iniResults.filter((result) => result.success).map((result) => result.file));

			if (queuedIniChanges.length) {
				setModList((prev: any) =>
					prev.map((mod: any) => {
						if (mod.path !== item.path) return mod;
						return {
							...mod,
							keys: mod.keys.map((k: any) => {
								const change = queuedIniChanges.find(
									(queued) => updatedFiles.has(queued.file) && queued.file === k.file && queued.target === k.target
								);
								return change ? { ...k, default: change.value } : k;
							}),
						};
					})
				);
			}

			await saveConfigs();
			if (item?.enabled) {
				await refreshMod(item.path);
			}
			const preferenceChanges = queuedDataChanges.filter((change) => change.type === "pref").length;
			const hotkeyChanges = queuedIniChanges.filter(
				(change) => updatedFiles.has(change.file) && Object.hasOwn(change.value, "hk")
			).length;
			const defaultChanges = queuedIniChanges.filter(
				(change) => updatedFiles.has(change.file) && Object.hasOwn(change.value, "def")
			).length;
			await Promise.all([
				preferenceChanges
					? trackUserAction({ action: "mod_preferences_changed", mod: item.path, count: preferenceChanges })
					: Promise.resolve(),
				hotkeyChanges
					? trackUserAction({ action: "mod_hotkeys_changed", mod: item.path, count: hotkeyChanges })
					: Promise.resolve(),
				defaultChanges
					? trackUserAction({ action: "mod_defaults_changed", mod: item.path, count: defaultChanges })
					: Promise.resolve(),
			]);
			setDataChanges({});
			setIniChanges({});
		} finally {
			setApplyingChanges(false);
		}
	}, [dataChanges, iniChanges, item, setData, setModList]);
	const colCount = 1 + (Object.keys(toggles).filter((key) => toggles[key]).length || 0);
	const headers = [
		<Tooltip>
			<TooltipTrigger className="text-accent flex items-center justify-center w-full gap-2">
				<InfoIcon className="text-accent/70 cursor-help inline-block w-4 h-4" />
				{textData._RightSideBar._components._ModPreferences.DefVal}
			</TooltipTrigger>
			<TooltipContent className="w-48 px-1 text-center">
				{textData._RightSideBar._components._ModPreferences.DefValTip}
			</TooltipContent>
		</Tooltip>,
		<Tooltip>
			<TooltipTrigger className="text-accent flex items-center justify-center w-full gap-2">
				<InfoIcon className="text-accent/70 cursor-help inline-block w-4 h-4" />
				{textData._RightSideBar._components._ModPreferences.Pref}
			</TooltipTrigger>
			<TooltipContent className="w-48 px-1 text-center">
				{textData._RightSideBar._components._ModPreferences.PrefTip}
			</TooltipContent>
		</Tooltip>,
		<Tooltip>
			<TooltipTrigger className="text-accent flex items-center justify-center w-full gap-2">
				{/* <InfoIcon className="text-accent/70 cursor-help inline-block w-4 h-4 ml-1" /> */}
				{textData._RightSideBar._components._ModPreferences.Expected}
			</TooltipTrigger>
			{/* <TooltipContent className="w-48 px-1 text-center">
							{
								"Shows the current key-binding for this variable. Future versions of IMM may allow changing key-bindings here."
							}
						</TooltipContent> */}
		</Tooltip>,
		<Tooltip>
			<TooltipTrigger className="text-accent  flex items-center justify-center w-full gap-2">
				<InfoIcon className="text-accent/70 cursor-help inline-block w-4 h-4" />
				{textData._RightSideBar._RightLocal.HotKeys}
			</TooltipTrigger>
			<TooltipContent className="w-48 px-1 text-center">
				{textData.Others.hkTip}
			</TooltipContent>
		</Tooltip>,
	];
	const hotKeyBlur = useCallback(
		(file: string, target: string, val: string, comp: string, reset: string) => {
			queueIniChange("hk", file, target, val, comp);
			// console.log("val", val, "comp", comp, "keyConfig.keyReset", keyConfig.keyReset);
			if (val === reset) {
				queueDataChange("keyReset", file, target, null, reset);
			} else if (val == comp || (!val && !comp)) {
				queueDataChange("keyReset", file, target, reset, reset);
			} else if (reset === null || reset === undefined) {
				queueDataChange("keyReset", file, target, comp, null);
			} else {
				queueDataChange("keyReset", file, target, reset, reset);
			}
		},
		[queueDataChange, queueIniChange]
	);
	return (
		<DialogContent
			className="min-w-250"
			onEscapeKeyDown={(e) => {
				if ((e.target as HTMLElement).tagName === "INPUT") {
					e.preventDefault();
				}
			}}
		>
			<Tooltip>
				<TooltipTrigger></TooltipTrigger>
				<TooltipContent className="opacity-0"></TooltipContent>
			</Tooltip>

			<div className="min-h-fit my-6 text-accent text-3xl">
				{" "}
				{textData._RightSideBar._components._ModPreferences.EditConfig}
			</div>

			<div className="text-sm flex px-10 w-full items-center gap-2">
				<div className="text-sm w-1/2 justify-center flex items-center gap-2">
					{/* <Checkbox checked={fileMode} onCheckedChange={(checked) => setFileMode(!!checked)} />{" "}
				{textData._RightSideBar._components._ModPreferences.ShowVars} */}
					{textData.Others.view}
					<Tabs
						value={configMode ? "config" : fileMode ? "file" : "general"}
						onValueChange={(value) => {
							if (value === "config") {
								setConfigMode(true);
								setFileMode(false);
							} else if (value === "file") {
								setConfigMode(false);
								setFileMode(true);
							} else {
								setConfigMode(false);
								setFileMode(false);
							}
						}}
					>
						<TabsList className="bg-background/50 button-like rounded-md grid w-full grid-cols-3">
							<TabsTrigger value="general">{textData.Others.hkOnly}</TabsTrigger>
							<TabsTrigger value="file">{textData.Others.allVars}</TabsTrigger>
							<TabsTrigger value="config">{textData.Others.immConf}</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
				<div className="text-sm flex  w-1/2 justify-center items-center gap-2">
					{/* <Checkbox checked={fileMode} onCheckedChange={(checked) => setFileMode(!!checked)} />{" "}
				{textData._RightSideBar._components._ModPreferences.ShowVars} */}
					{textData.Others.columns}
					<div className="text-sm grid grid-cols-4 items-center gap-2">
						{columns.map((key) => (
							<Toggle
								key={key}
								pressed={toggles[key]}
								onPressedChange={(pressed) => setToggles((prev) => ({ ...prev, [key]: pressed }))}
							>
								{textData2[key as keyof typeof textData2]}
							</Toggle>
						))}
					</div>
				</div>
			</div>
			<div
				style={{
					opacity: fileMode ? 1 : 0,
					pointerEvents: fileMode ? "auto" : "none",
					userSelect: fileMode ? "auto" : "none",
					minHeight: "2.75rem",
					marginBottom: fileMode ? 0 : "-1.5rem",
					marginTop: fileMode ? 0 : "-1.5rem",
				}}
				className="flex items-center duration-300 overflow-hidden w-full gap-2"
			>
				<Popover
					open={popoverOpen}
					onOpenChange={(open) => {
						setPopoverOpen(open);
					}}
				>
					<PopoverTrigger>
						<div className="min-w-179 button-like zzz-border w-full hover:brightness-150 bg-sidebar cursor-pointerx flex items-center justify-center h-full gap-1 p-2 text-xs duration-300 rounded-md select-none">
							{selectedFile ? (
								<>
									<FileIcon className="w-3 h-3" />
									{selectedFile}
								</>
							) : (
								textData._RightSideBar._components._ModPreferences.Select
							)}
						</div>
					</PopoverTrigger>
					<PopoverContent
						className="p-0 max-h-100 min-w-175 overflow-y-scroll scroll-auto z-100 pointer-events-auto"
						onWheel={(e) => {
							e.currentTarget.scrollBy({
								top: e.deltaY,
							});
						}}
					>
						{details?.files &&
							Object.keys(details.files).map((file: string, index: number) => (
								<div
									key={index}
									className="cursor-pointer hover:bg-background/50 px-4 py-2 text-sm"
									onClick={() => {
										setSelectedFile(file);
										const fileData = details.files[file] || [];
										const pagenatedData = [] as any;
										for (let i = 0; i < fileData.length; i += pageLimit) {
											pagenatedData.push(fileData.slice(i, i + pageLimit));
										}
										setSelectedFileData(pagenatedData);
										setPageNo(0);
										setPopoverOpen(false);
									}}
								>
									{file}
								</div>
							))}
					</PopoverContent>
				</Popover>
				<div className="flex w-full gap-2">
					<Button
						onClick={() => {
							setPageNo((prev) => Math.max(prev - 1, 0));
						}}
					>
						<ChevronLeftIcon className="w-3 h-3" />
					</Button>
					<div className="text-sm text-muted-foreground flex items-center justify-center min-w-fit">
						{textData._RightSideBar._components._ModPreferences.Page}
						<Input
							key={pageNo}
							defaultValue={pageNo + 1}
							onBlur={(e) => {
								const val = Number(e.currentTarget.value);
								if (isNaN(val) || val - 1 >= details.files[selectedFile]?.length / pageLimit) {
									e.currentTarget.value = String(pageNo + 1);
									return;
								}
								setPageNo(val - 1);
							}}
							className="text-center w-12 mx-2 p-1"
						/>
						{textData._RightSideBar._components._ModPreferences.Of}{" "}
						{details.files[selectedFile]?.length ? Math.ceil(details.files[selectedFile].length / pageLimit) : 1}
					</div>
					<Button
						onClick={() => {
							setPageNo((prev) =>
								Math.min(
									prev + 1,
									details.files[selectedFile]?.length
										? Math.ceil(details.files[selectedFile].length / pageLimit) - 1
										: 0
								)
							);
						}}
					>
						<ChevronRightIcon className="w-3 h-3" />
					</Button>
				</div>
			</div>
			<div
				style={{
					opacity: !configMode ? 1 : 0,
					pointerEvents: !configMode ? "auto" : "none",
					userSelect: !configMode ? "auto" : "none",
					minHeight: !configMode ? "2.75rem" : 0,
					marginBottom: !configMode ? 0 : "-1.5rem",
					marginTop: !configMode ? 0 : "-1.5rem",
				}}
				className="bg-background/80 button-like text-border duration-200 backdrop-blur-sm border-muted/20 sticky top-0 z-10 w-full px-10 items-center py-2 border rounded-md"
			>
				<div
					className="text-border grid w-full -ml-2"
					style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
				>
					<Tooltip>
						<TooltipTrigger className="text-accent  flex items-center justify-center w-full gap-2">
							<InfoIcon className="text-accent/70 cursor-help inline-block w-4 h-4 ml-1" />
							{textData._RightSideBar._components._ModPreferences.Name}
						</TooltipTrigger>
						<TooltipContent className="w-48 px-1 text-center">
							{textData._RightSideBar._components._ModPreferences.NameTip}
						</TooltipContent>
					</Tooltip>
					{/* <div className="text-accent w-1/5 text-center">Target Var</div>| */}
					{columns.map((key, i) => toggles[key] && <>{headers[i]}</>)}
				</div>
			</div>
			<label className="text-xs text-accent/50 -my-3">
				{textData._RightSideBar._components._ModPreferences.Priority}
			</label>

			{configMode ? (
				<JSONEditor rootJSON={item?.vars} rootKey={item?.path} />
			) : (
				<div
					className="max-h-90 min-h-90 flex flex-col w-full h-full p-2 pt-0 overflow-x-hidden overflow-y-scroll text-gray-300 rounded-sm"
					style={{
						minHeight: `calc(var(--spacing) * ${fileMode ? 83 : 90})`,
					}}
					key={"" + fileMode + pageNo + selectedFile + keys.length + forceKeyUpdate}
				>
					{keys.map((file: any, index: number) => (
						<div
							key={index}
							className="min-h-fit flex flex-col w-full px-4 py-2 mt-2 border rounded-md"
							style={{
								marginTop: index === 0 ? "0px" : "",
							}}
						>
							<div className="text-accent flex items-center gap-1 mb-2 text-sm">
								<Button
									className="aspect-square mt-0.5 max-h-5 max-w-5"
									onClick={() => {
										openFile(join(item.path, file.file));
									}}
								>
									<ArrowUpRightFromSquareIcon className="max-h-3" />
								</Button>
								{file.file}
							</div>
							{file.keys.map((keyConfig: any, index: number) => {
								const dataFile = keyConfig.namespace || keyConfig.file;

								const displayDefault = getIniValue("def", keyConfig.file, keyConfig.target, keyConfig.default);
								const displayName = getDataValue("name", keyConfig.file, keyConfig.target, keyConfig.name);
								const displayPref = getDataValue("pref", dataFile, keyConfig.target, keyConfig.pref);
								const displayKey = getIniValue("hk", keyConfig.file, keyConfig.target, keyConfig.key);
								const displayDefaultReset = getDataValue("reset", keyConfig.file, keyConfig.target, keyConfig.reset);
								const displayKeyReset = getDataValue("keyReset", keyConfig.file, keyConfig.target, keyConfig.keyReset);

								const nameDefault = displayName == keyConfig.target;
								const prefDefault = displayPref === null || displayPref === undefined || displayPref === "";
								const defDefault = displayDefaultReset === null || displayDefaultReset === undefined;
								const keyDefault = displayKeyReset === null || displayKeyReset === undefined || displayKeyReset === "";
								console.log("keydef", keyConfig);
								const elements = [
									<div className="w-full flex items-center">
										<Input
											className="text-muted-foreground w-full bg-transparent -mr-8.5"
											style={{
												textAlign: isNaN(Number(displayDefault)) ? "left" : "right",
												paddingRight: defDefault ? "" : "2rem",
											}}
											key={displayDefault}
											defaultValue={displayDefault}
											onBlur={(e) => {
												const val = e.currentTarget.value;
												if (!val) {
													e.currentTarget.value = displayDefault;
													return;
												}
												queueIniChange("def", keyConfig.file, keyConfig.target, val, keyConfig.default);
												if (val == keyConfig.default || (!val && !keyConfig.default)) {
													queueDataChange("reset", keyConfig.file, keyConfig.target, keyConfig.reset, keyConfig.reset);
												} else if (keyConfig.reset === null || keyConfig.reset === undefined) {
													queueDataChange("reset", keyConfig.file, keyConfig.target, keyConfig.default, null);
												} else if (val === keyConfig.reset) {
													queueDataChange("reset", keyConfig.file, keyConfig.target, null, keyConfig.reset);
												} else {
													queueDataChange("reset", keyConfig.file, keyConfig.target, keyConfig.reset, keyConfig.reset);
												}
											}}
										/>
										<Button
											variant="ghost"
											className=" h-7 w-7 ml-0.75"
											style={{
												pointerEvents: defDefault ? "none" : "auto",
												opacity: defDefault ? 0 : 1,
											}}
											onClick={(e) => {
												const prev = e.currentTarget.previousElementSibling as HTMLInputElement;
												if (prev) {
													prev.focus();
													prev.value = keyConfig.reset ?? keyConfig.default;
													prev.blur();
												}
											}}
										>
											<IterationCcwIcon className="max-h-4 rotate-180" />
										</Button>
									</div>,
									<div className="w-full flex items-center">
										<Input
											className="text-muted-foreground w-full bg-transparent duration-200 -mr-8.5"
											style={{
												textAlign: isNaN(Number(displayPref ?? keyConfig.default)) ? "left" : "right",
												paddingRight: prefDefault ? "" : "2rem",
											}}
											key={displayPref ?? ""}
											defaultValue={displayPref}
											onBlur={(e) => {
												const val = e.currentTarget.value;
												queueDataChange("pref", dataFile, keyConfig.target, val, keyConfig.pref);
											}}
											placeholder={
												keyConfig.state
													? `${textData._RightSideBar._components._ModPreferences.AutoSaved} ${keyConfig.state}`
													: textData.Others.none
											}
										/>

										<Button
											variant="ghost"
											className=" h-7 w-7 ml-0.75"
											style={{
												pointerEvents: prefDefault ? "none" : "auto",
												opacity: prefDefault ? 0 : 1,
											}}
											onClick={(e) => {
												const prev = e.currentTarget.previousElementSibling as HTMLInputElement;
												if (prev) {
													prev.focus();
													prev.value = "";
													prev.blur();
												}
											}}
										>
											<IterationCcwIcon className="max-h-4 rotate-180" />
										</Button>
									</div>,
									<div className="text-muted-foreground flex items-center justify-center w-full">
										{keyConfig.key
											? (keyConfig.values.toSorted().join(" , ") || "unknown").replace(
													"unknown",
													textData._RightSideBar._components._ModPreferences.Unknown
												)
											: "---"}
									</div>,
									<div className="w-full flex items-center">
										{keyConfig.key ? (
											<>
												<Input
													id={`mod-hotkey-${encodeURIComponent(`${keyConfig.file}-${keyConfig.target}`)}`}
													className="text-muted-foreground w-full bg-transparent duration-200 -mr-8.5"
													style={{
														textAlign: isNaN(Number(keyConfig.pref ?? keyConfig.default)) ? "left" : "right",
														paddingRight: "2rem",
													}}
													defaultValue={vkToDisplay(displayKey)}
													key={displayKey}
													autoFocus={false}
													contentEditable={false}
													onKeyDownCapture={(e) => {
														e.stopPropagation();
														e.preventDefault();
														let next: any = [];
														let key = formatKeysToDisplay(e.code)
															.split("")
															.map((x, i) => (i == 0 ? x.toUpperCase() : x))
															.join("");
														if (keyslist.includes(key)) {
															next = keyslist;
														} else {
															if (!keysdown.includes(e.code)) keysdown.push(e.code);
															keyslist.push(key);
															next = sortHotkeys(keyslist);
														}
														e.currentTarget.value = next.join(" ﹢ ");
														// }
													}}
													onKeyUpCapture={(e) => {
														e.stopPropagation();
														e.preventDefault();
														let key = e.code;
														let keyIndex = keysdown.indexOf(key);
														if (keyIndex > -1) keysdown.splice(keyIndex, 1);
														if (keysdown.length == 0) {
															keyslist = [];
															// console.log(encodeToVK(e.currentTarget.value));
															e.currentTarget.blur();
														}
													}}
													onBlur={(e) => {
														keysdown = [];
														keyslist = [];
														const val = encodeToVK(e.currentTarget.value);
														const comp = encodeToVK(vkToDisplay(keyConfig.key));
														hotKeyBlur(keyConfig.file, keyConfig.target, val, comp, keyConfig.keyReset);
													}}
													placeholder={textData.Others.none}
												/>

												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button variant="ghost" className="h-7 w-7 ml-0.75" aria-label="Hotkey options">
															<MoreVerticalIcon className="max-h-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end" className="min-w-32">
														<DropdownMenuItem
															disabled={keyDefault}
															onSelect={() => {
																const input = document.getElementById(
																	`mod-hotkey-${encodeURIComponent(`${keyConfig.file}-${keyConfig.target}`)}`
																) as HTMLInputElement | null;
																console.log("input", input);
																if (!input) return;
																input.value =
																	(keyConfig.keyReset ?? keyConfig.key)
																		? vkToDisplay(keyConfig.keyReset ?? keyConfig.key)
																		: "";
																hotKeyBlur(
																	keyConfig.file,
																	keyConfig.target,
																	encodeToVK(input.value),
																	encodeToVK(vkToDisplay(keyConfig.key)),
																	keyConfig.keyReset
																);
															}}
														>
															<IterationCcwIcon className="rotate-180" />
															{textData._RightSideBar._components._ManageCategories.Reset}
														</DropdownMenuItem>
														<DropdownMenuItem
															disabled={!displayKey}
															onSelect={() => {
																const input = document.getElementById(
																	`mod-hotkey-${encodeURIComponent(`${keyConfig.file}-${keyConfig.target}`)}`
																) as HTMLInputElement | null;
																if (!input) return;
																input.value = vkToDisplay("D I S A B L E");
																hotKeyBlur(
																	keyConfig.file,
																	keyConfig.target,
																	encodeToVK(input.value),
																	encodeToVK(vkToDisplay(keyConfig.key)),
																	keyConfig.keyReset
																);
															}}
														>
															<BanIcon />
															{textData._LeftSideBar._components._Settings._AutoReload.Disable}
														</DropdownMenuItem>
													</DropdownMenuContent>
												</DropdownMenu>
											</>
										) : (
											<div className="w-full text-center">---</div>
										)}
									</div>,
								];
								return (
									<div
										key={index}
										className="odd:bg-background/50 even:bg-background/30 text-border grid w-full gap-4 px-5 py-2 rounded-md"
										style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
									>
										<div className="w-full flex items-center">
											<Input
												className="text-muted-foreground w-full bg-transparent text-ellipsis -mr-8.5"
												key={displayName ?? ""}
												defaultValue={displayName}
												style={{
													paddingRight: nameDefault ? "" : "2rem",
												}}
												onBlur={(e) => {
													const val = e.currentTarget.value;
													if (val === keyConfig.target) {
														queueDataChange("name", keyConfig.file, keyConfig.target, null, keyConfig.name);
														return;
													}
													queueDataChange("name", keyConfig.file, keyConfig.target, val, keyConfig.name);
												}}
											/>
											<Button
												variant="ghost"
												className=" h-7 w-7 ml-0.75"
												style={{
													pointerEvents: nameDefault ? "none" : "auto",
													opacity: nameDefault ? 0 : 1,
												}}
												onClick={(e) => {
													const prev = e.currentTarget.previousElementSibling as HTMLInputElement;
													if (prev) {
														prev.focus();
														prev.value = keyConfig.target;
														prev.blur();
													}
												}}
											>
												<IterationCcwIcon className="max-h-4 rotate-180" />
											</Button>
										</div>
										{columns.map((key, i) => toggles[key] && elements[i])}
									</div>
								);
							})}
						</div>
					))}
				</div>
			)}
			<div className="flex w-full sticky bottom-0 justify-end -my-2 -mr-2px-2">
				<Button onClick={applyQueuedChanges} disabled={!queuedChangeCount || applyingChanges} variant="destructive">
					{applyingChanges ? textData.Others.applying : `${textData.Others.apply}${queuedChangeCount ? ` (${queuedChangeCount})` : ""}`}
				</Button>
			</div>
		</DialogContent>
	);
}

export default ModPreferences;

import { skipPage } from "@/_Checklist/pages/Page3";
import { addToast } from "@/_Toaster/ToastProvider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GAME_NAMES, LANG_LIST } from "@/utils/consts";
import { saveConfigs, setConfig } from "@/utils/filesys";
import { join, setHotreload } from "@/utils/hotreload";
import { getCwd, setPrePostLaunch, setWindowType } from "@/utils/init";
import { readTextFile } from "@/utils/fs";
import { toFs } from "@/utils/pathsep";
import TEXT from "@/textData.json";
import { exportConfig } from "@/utils/utils";
import { INIT_DONE, SAVED_LANG, SETTINGS, SOURCE, store, TARGET, TEXT_DATA, XXMI_MODE } from "@/utils/vars";
import { Separator } from "@radix-ui/react-separator";
import { open } from "@tauri-apps/plugin-dialog";
import { useAtom, useAtomValue } from "jotai";
import {
	AppWindowIcon,
	CheckIcon,
	CircleSlashIcon,
	DownloadIcon,
	EyeClosedIcon,
	EyeIcon,
	EyeOffIcon,
	FocusIcon,
	FolderCog2Icon,
	Gamepad2Icon,
	Globe2,
	HardDriveIcon,
	InfoIcon,
	LanguagesIcon,
	Maximize2Icon,
	MonitorIcon,
	MouseIcon,
	MousePointerClickIcon,
	PauseIcon,
	PlayIcon,
	Settings2Icon,
	SettingsIcon,
	SquareIcon,
	UploadIcon,
	XIcon,
} from "lucide-react";
import { ComponentType, ReactNode, useRef, useState } from "react";
let bg: HTMLBodyElement | null = null;

function SettingSection(sec: {
	id: string;
	title: string;
	children: ReactNode;
	icon: ComponentType<{ className?: string }> | null;
}) {
	return (
		<div
			id={sec.id}
			className={`bg-card/0 flex flex-col w-full gap-4 px-3 py-2 pb-4 ${sec.id !== "misc-container" && "border-b"}`}
		>
			<label className="text-accent flex items-center gap-1 -mb-2 text-lg">
				{sec.icon ? (
					<sec.icon className="w-5 h-5 text-gray-300" />
				) : (
					<div className="height-2 aspect-square data-sr:mr-1 group-hover:invert-100 group-hover:hue-rotate-180 logo min-h-5 text-gray-300 duration-300"></div>
				)}
				{sec.title}
			</label>
			{sec.children}
		</div>
	);
}

function SettingRow({ label, children }: { label: any; children: ReactNode }) {
	return (
		<div className="flex items-center w-full gap-4 px-2">
			<label className="flex items-center w-1/3 gap-1 text-sm text-gray-300">{label}</label>
			<div className="justify-evenly flex w-2/3">{children}</div>
		</div>
	);
}

function SettingTabs({
	defaultValue,
	onValueChange,
	options,
	disabled = false,
}: {
	defaultValue: string;
	onValueChange: (value: string) => void;
	disabled?: boolean;
	options: { value: string; icon?: ComponentType<{ className?: string }>; label: string; icons?: any }[];
}) {
	return (
		<Tabs
			style={
				disabled
					? {
							pointerEvents: "none",
							filter: "brightness(0.5)",
						}
					: {}
			}
			defaultValue={defaultValue}
			onValueChange={onValueChange}
			className="w-full"
		>
			<TabsList className=" w-full">
				{options.map((opt) => (
					<TabsTrigger key={opt.value} value={opt.value} className="h-10" style={{ width: `${100 / options.length}%` }}>
						{opt.icon && <opt.icon className="aspect-square h-full pointer-events-none" />}
						{opt.icons}
						{opt.label}
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
function SettingsSlideover({ leftSidebarOpen }: { leftSidebarOpen: boolean }) {
	const textData = useAtomValue(TEXT_DATA);
	const customMode = useAtomValue(XXMI_MODE);
	// const [presets, setPresets] = useAtom(PRESETS);
	const [curMenu, setCurMenu] = useState(0);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [savedLang, setSavedLang] = useAtom(SAVED_LANG);
	const [alertType, setAlertType] = useState<"lang" | "xxmi">("lang");
	const [source, setSource] = useAtom(SOURCE);
	const [target, setTarget] = useAtom(TARGET);
	const [settings, setSettings] = useAtom(SETTINGS);
	const scrollTimer = useRef<number>(null);
	const [alertOpen, setAlertOpen] = useState(false);
	const [langAlertData, setLangAlertData] = useState({ prev: "en", new: "en" } as {
		prev: keyof typeof TEXT;
		new: keyof typeof TEXT;
	});
	const importConfig = async () => {
		try {
			const dialogOptions: any = {
				title: textData.ImportPop || "Import Config",
				filters: [
					{
						name: "JSON files",
						extensions: ["json", "json.bak", "json.bak.bak"],
					},
				],
			};

			dialogOptions.defaultPath = toFs(join(getCwd(), "backups"));

			const filePath = await open(dialogOptions);

			if (filePath) {
				const content = await readTextFile(filePath as string);
				try {
					setConfig(JSON.parse(content));
					setSettingsOpen(false);
					addToast({ type: "success", message: textData.ConfigImported });
				} catch {
					addToast({ type: "error", message: textData.InvalidConfig });
				}
			}
		} catch (error) {
			addToast({ type: "error", message: textData.ErrorImporting });
		}
	};
	const options = [
		{
			key: "lang",
			label: textData.Language,
			icon: LanguagesIcon,
			content: (
				<div className="justify-evenly flex w-full">
					{LANG_LIST.map((lang) => (
						<div
							key={lang.Code}
							className={`hover:brightness-150 flex-col flex items-center justify-center group gap-1 text-sm duration-300 cursor-pointerx select-none`}
							onClick={() => {
								if (savedLang == lang.Code) return;
								setLangAlertData({
									prev: savedLang || "en",
									new: lang.Code as keyof typeof TEXT,
								});
								setAlertType("lang");
								setAlertOpen(true);
							}}
						>
							<img src={lang.Flag} alt={lang.Name} className="group-hover:scale-120 w-8 h-8 duration-200" />
							<span
								className="text-gray-300 whitespace-nowrap opacity-50 -mt-1.5 group-hover:mt-0 group-hover:-mb-1.5 overflow-hidden text-xs duration-200"
								style={{
									opacity: savedLang == lang.Code ? "1" : "",
									color: savedLang == lang.Code ? "var(--accent)" : "",
									fontFamily: `var(--game-font-${lang.Code})`,
								}}
							>
								{lang.Name}
							</span>
						</div>
					))}
				</div>
			),
		},
		{
			key: "disp",
			label: "Display",
			icon: MonitorIcon,
			content: (
				<>
					<SettingRow label={textData.WindowType}>
						<SettingTabs
							defaultValue={settings.global.display.winType.toString()}
							onValueChange={(e) => {
								setSettings((prev) => {
									prev.global.display.winType = parseInt(e) as 0 | 2;
									return { ...prev };
								});
								setWindowType(parseInt(e));
								saveConfigs();
							}}
							options={[
								{
									value: "0",
									icon: AppWindowIcon,
									label: textData.Windowed,
								},
								{
									value: "2",
									icon: Maximize2Icon,
									label: textData.Fullscreen,
								},
							]}
						/>
					</SettingRow>

					<SettingRow label={textData.WindowBGOpacity}>
						<Slider
							defaultValue={[settings.global.display.bgOpacity * 100]}
							max={100}
							min={0}
							step={1}
							className="w-full m-1"
							onValueChange={(e) => {
								bg = bg || document.querySelector("body");
								if (bg) bg.style.backgroundColor = "color-mix(in oklab, var(--background) " + e + "%, transparent)";
							}}
							onValueCommit={(e) => {
								setSettings((prev) => {
									prev.global.display.bgOpacity = e[0] / 100;
									return { ...prev };
								});
								saveConfigs();
							}}
						/>
					</SettingRow>
					<SettingRow label={textData.BgType}>
						<SettingTabs
							defaultValue={settings.global.display.bgType.toString()}
							onValueChange={(e) => {
								setSettings((prev) => {
									prev.global.display.bgType = parseInt(e) as 0 | 1 | 2;
									return { ...prev };
								});
								saveConfigs();
							}}
							options={[
								{ value: "0", icon: SquareIcon, label: textData.Blank },
								{ value: "1", icon: PauseIcon, label: textData.Static },
								{ value: "2", icon: PlayIcon, label: textData.Dynamic },
							]}
						/>
					</SettingRow>
				</>
			),
		},
		{
			key: "local",
			label: "Local",
			icon: HardDriveIcon,
			content: (
				<>
					<SettingRow label={textData.Toggle}>
						<SettingTabs
							defaultValue={settings.global.local.toggleClick.toString()}
							onValueChange={(e) => {
								setSettings((prev) => {
									prev.global.local.toggleClick = parseInt(e) as 0 | 2;
									return { ...prev };
								});
								saveConfigs();
							}}
							options={[
								{
									value: "0",
									icons: (
										<>
											<MousePointerClickIcon className=" rotate-y-180 w-4 -mr-2" />
											<MouseIcon />
										</>
									),
									label: textData.LeftClick,
								},
								{
									value: "2",
									icons: (
										<>
											<MouseIcon />
											<MousePointerClickIcon className=" w-4 -ml-2" />
										</>
									),
									label: textData.RightClick,
								},
							]}
						/>
					</SettingRow>
				</>
			),
		},
		{
			key: "online",
			label: "Online",
			icon: Globe2,
			content: (
				<>
					<SettingRow
						label={
							<>
								<Tooltip>
									<TooltipTrigger className="-ml-5">
										<InfoIcon className="text-muted-foreground hover:text-gray-300 w-4 h-4" />
									</TooltipTrigger>
									<TooltipContent>
										<div className="flex flex-col gap-1">
											<div>
												<b>{textData.Remove} -</b>{" "}
												{textData.RemoveMsg}
											</div>
											<div>
												<b>{textData.NSFWBlur} -</b>{" "}
												{textData.BlurMsg}
											</div>
											<div>
												<b>{textData.Show} -</b>{" "}
												{textData.ShowMsg}
											</div>
										</div>
									</TooltipContent>
								</Tooltip>
								{textData.SettingsNSFW}
							</>
						}
					>
						<SettingTabs
							defaultValue={settings.global.online.nsfw.toString()}
							onValueChange={(e) => {
								setSettings((prev) => {
									prev.global.online.nsfw = parseInt(e) as 0 | 1 | 2;
									return { ...prev };
								});
								saveConfigs();
							}}
							options={[
								{
									value: "0",
									icon: EyeOffIcon,
									label: textData.Remove,
								},
								{
									value: "1",
									icon: EyeClosedIcon,
									label: textData.NSFWBlur,
								},
								{
									value: "2",
									icon: EyeIcon,
									label: textData.Show,
								},
							]}
						/>
					</SettingRow>
				</>
			),
		},
		{
			key: "game",
			label: GAME_NAMES[settings.global.game],
			icon: null,
			content: (
				<>
					<SettingRow
						label={
							<>
								<Tooltip>
									<TooltipTrigger className="-ml-5">
										<InfoIcon className="text-muted-foreground hover:text-gray-300 w-4 h-4" />
									</TooltipTrigger>
									<TooltipContent>
										<div className="flex flex-col gap-1">
											<div>
												<b>{textData.Disable} -</b>{" "}
												{textData.NoChanges}
											</div>
											<div>
												<b>IMM -</b> {textData.LaunchGame}
											</div>
											<div>
												<b>{settings.global.game}MI -</b>{" "}
												{textData.LaunchIMM.replace(
													"<game/>",
													settings.global.game
												)}
											</div>
										</div>
									</TooltipContent>
								</Tooltip>
								{textData.LaunchSettings}
							</>
						}
					>
						<SettingTabs
							defaultValue={settings.game.launch.toString()}
							disabled={customMode == 1}
							onValueChange={(e) => {
								let val = parseInt(e) as 0 | 1 | 2;
								if (val == 2 || settings.game.launch == 2) setPrePostLaunch(settings.global.game, val == 2);
								if (val == 2) {
									setAlertType("xxmi");
									setAlertOpen(true);
								}
								setSettings((prev) => {
									prev.game.launch = val;
									return { ...prev };
								});
								saveConfigs();
							}}
							options={[
								{
									value: "0",
									icon: XIcon,
									label: textData.Disable,
								},
								{
									value: "1",
									icon: CheckIcon,
									label: "IMM",
								},
								{
									value: "2",
									icon: Gamepad2Icon,
									label: `${settings.global.game}MI`,
								},
							]}
						/>
					</SettingRow>
					<SettingRow
						label={
							<>
								<Tooltip>
									<TooltipTrigger className="-ml-5">
										<InfoIcon className="text-muted-foreground hover:text-gray-300 w-4 h-4" />
									</TooltipTrigger>
									<TooltipContent>
										<div className="flex flex-col gap-1">
											<div>
												<b>{textData.Disable} -</b>{" "}
												{textData.DisableMsg}
											</div>
											<div>
												<b>IMM -</b> {textData.WWMMMsg}
											</div>
											<div>
												<b>{textData.OnFocus} -</b>{" "}
												{textData.FocusMsg}
											</div>
											<Separator />
											<div>{textData.ReloadMsg}</div>
										</div>
									</TooltipContent>
								</Tooltip>
								{textData.AutoReload}
							</>
						}
					>
						<SettingTabs
							defaultValue={settings.game.hotReload.toString()}
							onValueChange={(e: any) => {
								e = parseInt(e) as 0 | 1 | 2;
								setSettings((prev) => {
									prev.game.hotReload = e;
									return { ...prev };
								});
								setHotreload(e, settings.global.game, target);
								saveConfigs();
							}}
							options={[
								{
									value: "0",
									icon: CircleSlashIcon,
									label: textData.Disable,
								},
								{
									value: "1",
									icon: AppWindowIcon,
									label: "IMM",
								},
								{
									value: "2",
									icon: FocusIcon,
									label: textData.OnFocus,
								},
							]}
						/>
					</SettingRow>
					<SettingRow label={customMode ? textData.ModDir : textData.XXMIDir}>
						{/* <Button
							className="w-full"
							onClick={() => {
								setSource("");
								setTarget("");
								setSettingsOpen(false);
								skipPage();
								store.set(INIT_DONE, false);
							}}
						>
							{textData.HelpChange}
						</Button> */}
						<Button
							className="aspect-square bg-accent text-background items-center justify-center"
							onClick={() => {
								setSource("");
								setTarget("");
								setSettingsOpen(false);
								skipPage();
								store.set(INIT_DONE, false);
							}}
						>
							<FolderCog2Icon className="inline w-4 h-4" />
						</Button>
						<Input
							type="text"
							readOnly
							className="border-border/0 bg-input/50 text-accent/75 text-ellipsis button-like w-full h-10 ml-2 overflow-hidden text-center cursor-default"
							value={
								source
									? (source.includes("AppData\\Roaming\\")
											? `...\\${source.split("AppData\\Roaming\\").pop()}`
											: source
										).replace("/", "\\")
									: "-"
							}
						/>
					</SettingRow>
				</>
			),
		},
		{
			key: "misc",
			label: "Misc",
			icon: Settings2Icon,
			content: (
				<>
					<SettingRow label={textData.ImportExport}>
						{/* <Button
							className="w-full"
							onClick={() => {
								setSource("");
								setTarget("");
								setSettingsOpen(false);
								skipPage();
								store.set(INIT_DONE, false);
							}}
						>
							{textData.HelpChange}
						</Button> */}
						<div className="flex justify-start w-full gap-2 pr-2">
							<Button
								// disabled={disabled}
								onClick={importConfig}
								className="h-9 z-1 bg-input/25 text-accent hover:text-background group w-1/2 text-sm"
								variant="ghost"
							>
								<DownloadIcon className="w-4 h-4" />
								{textData.Import}
							</Button>
							<Button
								onClick={() => exportConfig(settings, textData)}
								className="h-9 z-1 bg-input/25 text-accent hover:text-background group w-1/2 text-sm"
								variant="ghost"
							>
								<UploadIcon className="w-4 h-4" />
								{textData.Export}
							</Button>
						</div>
					</SettingRow>
				</>
			),
		},
	];
	return (
		<Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
			<DialogTrigger asChild>
				<Button
					onClick={() => {}}
					className="w-38.75 text-ellipsis peer h-12 overflow-hidden"
					style={{ width: leftSidebarOpen ? "" : "3rem", borderRadius: leftSidebarOpen ? "" : "999px" }}
				>
					<SettingsIcon />
					{leftSidebarOpen && textData.Settings}
				</Button>
			</DialogTrigger>
			<DialogContent hideClose className="max-h-[calc(100vh-1rem)] pb-0 left-104 min-w-210 h-full data-[state=closed]:slide-out-to-left-25 data-[state=open]:slide-in-from-left-25  data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100">
				<AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
					<AlertDialogContent
						className="game-font bg-background/50 backdrop-blur-xs border-border flex flex-col items-center gap-4 p-4 overflow-hidden border-2 rounded-lg"
						style={{
							minWidth: alertType === "xxmi" ? "43.75rem" : "",
							maxWidth: alertType === "xxmi" ? "43.75rem" : "",
						}}
					>
						{alertType === "xxmi" ? (
							<>
								<div className=" flex flex-col items-center mt-6 text-center">
									<div className="flex flex-col items-center justify-center gap-2 mb-8 text-3xl text-gray-200">
										{textData.Note}
									</div>
									<img src="xxmi-warn.png" className="rounded-xl min-w-164 max-w-164" />
									<div className="h-12 w-49  -ml-85.25 -mt-15.5 border border-accent animate-pulse rounded-lg" />

									<div className="text-accent mt-6">
										{textData.Warn1}
									</div>
									<div className="text-accent">{textData.Warn2}</div>
								</div>
								<div className="flex justify-center w-full gap-4 mt-4">
									<AlertDialogAction className="min-w-24 duration-300">{textData.Confirm}</AlertDialogAction>
								</div>
							</>
						) : (
							<>
								<div className=" flex flex-col items-center gap-6 mt-6 text-center">
									<div className="flex flex-col items-center justify-center gap-2 text-xl text-gray-200">
										{TEXT[langAlertData.prev].Change + TEXT[langAlertData.prev][langAlertData.new]}
										?
										<Separator />
										<span
											style={{
												fontFamily: `var(--game-font-${langAlertData.new})`,
											}}
										>
											{TEXT[langAlertData.new].Change + TEXT[langAlertData.new][langAlertData.new]}?
										</span>
									</div>

									{langAlertData.new !== "en" && (
										<div className="max-w-96 text-accent flex flex-col gap-4 text-sm">
											<span>
												{TEXT[langAlertData.prev].Warning1 + " "}
												{TEXT[langAlertData.prev].Warning2}
											</span>
											{langAlertData.new === "cn"
												? TEXT[langAlertData.prev].CredCN
												: langAlertData.new === "ru"
													? TEXT[langAlertData.prev].CredRU
													: ""}

											<span
												style={{
													fontFamily: `var(--game-font-${langAlertData.new})`,
												}}
											>
												{TEXT[langAlertData.new].Warning1 + " "}
												{TEXT[langAlertData.new].Warning2}
											</span>
											<span
												style={{
													fontFamily: `var(--game-font-${langAlertData.new})`,
												}}
											>
												{langAlertData.new === "cn"
													? TEXT[langAlertData.new].CredCN
													: langAlertData.new === "ru"
														? TEXT[langAlertData.new].CredRU
														: ""}
											</span>
										</div>
									)}
								</div>
								<div className="flex justify-between w-full gap-4 mt-4">
									<AlertDialogCancel className="min-w-24 duration-300">
										{TEXT[langAlertData.prev].Cancel} |
										<span
											style={{
												fontFamily: `var(--game-font-${langAlertData.new})`,
											}}
										>
											{TEXT[langAlertData.new].Cancel}
										</span>
									</AlertDialogCancel>
									<AlertDialogAction
										className="min-w-24 text-accent "
										onClick={() => {
											setSavedLang(langAlertData.new);
											setAlertOpen(false);
										}}
									>
										{TEXT[langAlertData.prev].Confirm} |
										<span
											style={{
												fontFamily: `var(--game-font-${langAlertData.new})`,
											}}
										>
											{TEXT[langAlertData.new].Confirm}
										</span>
									</AlertDialogAction>
								</div>
							</>
						)}
					</AlertDialogContent>
				</AlertDialog>
				
				<div className="flex w-full h-full">
					<div className="shrink-0 max-h-116 justify-evenly relative flex flex-col w-24 h-full gap-1 pr-4">
						<div
							className="absolute w-[calc(100%-1rem)] rounded-lg h-16 mt-2 z-0 duration-300 bg-accent"
							style={{
								top: curMenu * 4.78125 + "rem",
							}}
						/>
						{options.map((option, index) => {
							const Icon = option.icon;
							return (
								<>
									<Button
										key={option.key}
										variant="ghost"
										className="z-1  text-accent hover:text-background group as flex-col w-20 h-16 gap-0.5"
										style={{
											color: curMenu == index ? "var(--background)" : "",
											borderRadius: "0.5rem",
										}}
										onClick={() => {
											setCurMenu(index);
											const container = document.getElementById("parent-container");
											const target = document.getElementById(option.key + "-container");
											if (target && container) {
												container.scrollTo({
													top: target.offsetTop - container.offsetTop,
													behavior: "smooth",
												});
											}
										}}
									>
										{Icon ? (
											<Icon
												className="group-hover:text-background w-5 h-5 text-gray-300 duration-300"
												style={{
													color: curMenu == index ? "var(--background)" : "",
												}}
											/>
										) : (
											<div
												className="height-2 aspect-square group-hover:invert-100 group-hover:hue-rotate-180 logo min-h-5 duration-300"
												style={{
													filter: curMenu == index ? "invert(1) hue-rotate(180deg)" : "",
												}}
											></div>
										)}
										{option.label}
									</Button>
								</>
							);
						})}
					</div>
					<div
						id="parent-container"
						className="flex flex-col w-[calc(100%-6rem)] border-l max-h-[calc(100vh-3.125rem)] pb-[90vh] gap-2 px-4 shrink-0 h-full overflow-y-scroll overflow-x-hidden"
						onScroll={(e) => {
							const cur = e.currentTarget;
							const children = Array.from(cur.children) as HTMLDivElement[];
							const next = children.find((child) => child.offsetTop - cur.scrollTop >10);
							if (next) {
								if (scrollTimer.current) clearTimeout(scrollTimer.current);
								scrollTimer.current = setTimeout(() => {
									setCurMenu(children.indexOf(next));
								}, 100);
							}
						}}
					>
						{/* <div id="lang-container" className="flex flex-col w-full gap-1"></div>
						<SettingSection id="disp-container" title="Display"></SettingSection>
						<SettingSection id="local-container" title={"Local"}></SettingSection> */}
						{options.map((opt) => (
							<SettingSection
								key={opt.key}
								id={opt.key.toLowerCase() + "-container"}
								icon={opt.icon}
								title={opt.label}
								children={opt.content}
							/>
						))}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default SettingsSlideover;

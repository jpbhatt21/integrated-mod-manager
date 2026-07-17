import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { confirmAndCancelDownloadsForGameSwitch } from "@/utils/downloadManager";
import { remMoveMods, remSaveModData, remSavePresets, saveConfigs } from "@/utils/filesys";
import { exportConfig } from "@/utils/utils";
import { CATEGORIES, REMOVE_OPEN, SETTINGS, TARGET, TEXT_DATA } from "@/utils/vars";
import { useAtom, useAtomValue } from "jotai";
import { CheckCircleIcon, ChevronLeftIcon, CircleIcon, FolderIcon, InfoIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
type keys = "category" | "enable" | "data" | "modData" | "presetData";

function Remove() {
	const [removeOpen, setRemoveOpen] = useAtom(REMOVE_OPEN);
	const tgt = useAtomValue(TARGET);
	const categories = useAtomValue(CATEGORIES);
	// remSaveModData();
	const [removeSettings, setRemoveSettings] = useState({
		category: "1",
		enable: "1",
		data: "0",
		modData: "0",
		presetData: "0",
	});
	const [settings, setSettings] = useAtom(SETTINGS);
	const textData = useAtomValue(TEXT_DATA);
	const [disableButtons, setDisableButtons] = useState(false);
	const reloadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const [progress, setProgress] = useState({
		started: false,
		index: 0,
		actions: [] as keys[],
		max: 0,
	});
	const dict = {
		category: {
			title: textData.DirStruct,
			options: [
				textData.Flat,
				textData.Categorized,
			],
			action: "",
			button: "",
			doing: "",
		},
		enable: {
			title: textData.EnDisbMods,
			options: [
				textData.DisAll,
				textData.Unchanged,
				textData.EnAll,
			],
			action: textData.CompleteRem,
			button: textData.Move,
			doing: textData.RemoveIMMMoving,
		},
		data: {
			title: textData.IMMData,
			options: [textData.NoExp, textData.Exp],
			action: textData.ExpIMM,
			button: textData.Export,
			doing: textData.Exporting,
		},
		modData: {
			title: textData.ModData,
			options: [
				textData.NoSave,
				textData.SaveRef,
			],
			action: textData.SaveMD,
			button: textData.Save,
			doing: textData.Saving,
		},
		presetData: {
			title: textData.PresetData,
			options: [
				textData.NoSave,
				textData.SaveRef,
			],
			action: textData.SavePS,
			button: textData.Save,
			doing: textData.Saving,
		},
	};
	useEffect(() => {
		if (progress.started && progress.index == progress.max) {
			if (reloadIntervalRef.current) return;
			let time = 5;
			let timer = null as any;
			reloadIntervalRef.current = setInterval(async () => {
				if (!timer) timer = document.getElementById("reloadTimer");
				if (timer && time >= 0)
					timer.innerText = textData.AppRL.replace("<s/>", Math.ceil(time).toString());
				if (time <= 0) {
					if (reloadIntervalRef.current) clearInterval(reloadIntervalRef.current);
					reloadIntervalRef.current = null;
					if (!(await confirmAndCancelDownloadsForGameSwitch())) return;
					setSettings((prev) => ({ ...prev, global: { ...prev.global, game: "" } }));
					await saveConfigs();
					window.location.reload();
				}
				time -= 0.1;
			}, 100);
		}
		return () => {
			if (reloadIntervalRef.current && (!progress.started || progress.index < progress.max)) {
				clearInterval(reloadIntervalRef.current);
				reloadIntervalRef.current = null;
			}
		};
	}, [progress]);
	return (
		<Dialog open={removeOpen || progress.started} onOpenChange={setRemoveOpen}>
			<DialogContent
				className=""
				style={{
					minHeight: progress.started ? "calc(100vh - 2rem)" : "",
					minWidth: progress.started ? "100vw" : "",
				}}
			>
				{" "}
				<div className="min-h-fit text-accent my-6 text-3xl">
					{textData.RemoveIMM}
				</div>
				{!progress.started && (
					<div className="w-full h-full flex flex-col gap-2.5 items-center">
						<label className="text-warn -mb-4">{textData.MoveAll}</label>
						<label>{tgt}</label>
						<div className="flex flex-col w-full gap-2">
							<label>{dict.category.title}</label>

							<Tabs
								value={removeSettings.category}
								onValueChange={(val) => {
									setRemoveSettings((prev) => ({ ...prev, category: val }));
								}}
								className="w-full"
							>
								<TabsList className="bg-background/0 h-10 w-full">
									<TabsTrigger value="0">{dict.category.options[0]}</TabsTrigger>
									<TabsTrigger value="1">{dict.category.options[1]}</TabsTrigger>
								</TabsList>
							</Tabs>
							<div className="flex w-full gap-6 px-2 items-center justify-between">
								<div
									className={`flex border duration-200 overflow-hidden rounded flex-col w-1/2 ${removeSettings.category == "0" && "border-accent"}`}
									onClick={() => setRemoveSettings((prev) => ({ ...prev, category: "0" }))}
								>
									{"1234".split("").map((item, index) => (
										<div
											className={"w-full flex  flex-col"}
											style={{
												backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150",
											}}
										>
											<div
												className={
													"w-full h-8 flex gap-2 items-center px-2 border-b " + (index !== 0 ? "border-t " : "")
												}
											>
												<FolderIcon className="w-4 h-4" />
												<Label>Mod {item}</Label>
											</div>
										</div>
									))}
								</div>
								<div
									className={`flex border duration-200 overflow-hidden rounded flex-col w-1/2 ${removeSettings.category == "1" && "border-accent"}`}
									onClick={() => setRemoveSettings((prev) => ({ ...prev, category: "1" }))}
								>
									{categories.slice(0, 2).map((item, index) => (
										<div
											className={"w-full flex  flex-col"}
											style={{
												backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150",
											}}
										>
											<div
												className={
													"w-full h-8 flex gap-2 items-center px-2 border-b " + (index !== 0 ? "border-t " : "")
												}
											>
												{item._sIconUrl && (
													<img
														src={item._sIconUrl}
														onError={(e) => {
															e.currentTarget.src = "/who.jpg";
														}}
														className="w-6 h-6 -ml-1 -mr-1 overflow-hidden rounded-full"
														alt="icon"
													/>
												)}
												<Label className={"w-full pointer-events-none " + ((index % 2) + 1)}>{item._sName}</Label>
											</div>
											<div className="flex flex-col items-center w-full pl-4">
												<div
													className={"w-full h-8 border-l flex gap-2 items-center px-2 "}
													style={{
														backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150",
													}}
												>
													<FolderIcon className="w-4 h-4" />
													<Label className="w-full pointer-events-none">Mod {index + 1}</Label>
												</div>
											</div>
										</div>
									))}
								</div>
							</div>
						</div>
						<div className="flex w-full items-center justify-between">
							<label className="w-2/5">{dict.enable.title}</label>
							<Tabs
								defaultValue={removeSettings.enable}
								onValueChange={(val) => {
									setRemoveSettings((prev) => ({ ...prev, enable: val }));
								}}
								className="w-3/5"
							>
								<TabsList className="bg-background/0 h-10 w-full">
									{/* <TabsTrigger value="0">Disable All</TabsTrigger>
									<TabsTrigger value="1">Unchanged</TabsTrigger>
									<TabsTrigger value="2">Enable All</TabsTrigger> */}
									{dict.enable.options.map((option, index) => (
										<TabsTrigger key={index} value={index.toString()}>
											{option}
										</TabsTrigger>
									))}
								</TabsList>
							</Tabs>
						</div>
						<div className="flex w-full items-center justify-between">
							<label className="w-2/5 flex items-center gap-1">
								<Tooltip>
									<TooltipTrigger>
										<InfoIcon className="inline-block w-4 h-4 mb-0.75" />
									</TooltipTrigger>
									<TooltipContent className="max-w-48 justify-center text-center">
										{textData.IMMTip}
									</TooltipContent>
								</Tooltip>
								{dict.data.title}
							</label>
							<Tabs
								defaultValue={removeSettings.data}
								onValueChange={(val) => {
									setRemoveSettings((prev) => ({ ...prev, data: val }));
								}}
								className="w-3/5"
							>
								<TabsList className="bg-background/0 h-10 w-full">
									<TabsTrigger value="0">{dict.data.options[0]}</TabsTrigger>
									<TabsTrigger value="1">{dict.data.options[1]}</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
						<div className="flex w-full items-center justify-between">
							<label className="w-2/5 flex items-center gap-1">
								<Tooltip>
									<TooltipTrigger>
										<InfoIcon className="inline-block w-4 h-4 mb-0.75" />
									</TooltipTrigger>
									<TooltipContent className="max-w-48 justify-center text-center">
										{textData.ModTip}
									</TooltipContent>
								</Tooltip>
								{dict.modData.title}
							</label>
							<Tabs
								defaultValue={removeSettings.modData}
								onValueChange={(val) => {
									setRemoveSettings((prev) => ({ ...prev, modData: val }));
								}}
								className="w-3/5"
							>
								<TabsList className="bg-background/0 h-10 w-full">
									<TabsTrigger value="0">{dict.modData.options[0]}</TabsTrigger>
									<TabsTrigger value="1">{dict.modData.options[1]}</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
						<div className="flex w-full items-center justify-between">
							<label className="w-2/5 flex items-center gap-1">
								<Tooltip>
									<TooltipTrigger>
										<InfoIcon className="inline-block w-4 h-4 mb-0.75" />
									</TooltipTrigger>
									<TooltipContent className="max-w-48 justify-center text-center">
										{textData.PresetTip}
									</TooltipContent>
								</Tooltip>
								{dict.presetData.title}
							</label>
							<Tabs
								defaultValue={removeSettings.presetData}
								onValueChange={(val) => {
									setRemoveSettings((prev) => ({ ...prev, presetData: val }));
								}}
								className="w-3/5"
							>
								<TabsList className="bg-background/0 h-10 w-full">
									<TabsTrigger value="0">{dict.presetData.options[0]}</TabsTrigger>
									<TabsTrigger value="1">{dict.presetData.options[1]}</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="destructive">{textData.ConfRem}</Button>
							</AlertDialogTrigger>
							<AlertDialogContent className="gap-2">
								<AlertDialogHeader className="text-3xl text-accent">{textData.Confirm}</AlertDialogHeader>
								<div className="text-center text-destructive max-w-4/5">
									{textData.Recheck}
								</div>
								<div className="w-full">
									{Object.keys(dict).map((key: any) => (
										<div key={key} className="flex w-full items-center justify-between">
											<Label>{dict[key as keys].title}</Label>
											<Label className="text-muted-foreground">
												{dict[key as keys].options[removeSettings[key as keys] as any]}
											</Label>
										</div>
									))}
								</div>
								<p className="text-warn text-center">{textData.AsConf}</p>
								<div className="w-full flex justify-between">
									<AlertDialogAction>{textData.Cancel}</AlertDialogAction>
									<AlertDialogCancel
										onClick={() => {
											const prg = {
												started: true,
												actions: [] as keys[],
												max: 0,
												index: 0,
											} as any;
											const stg = removeSettings;

											if (stg.data == "1") {
												prg.max += 1;
												prg.actions.push("data");
											}
											if (stg.modData == "1") {
												prg.max += 1;
												prg.actions.push("modData");
											}
											if (stg.presetData == "1") {
												prg.max += 1;
												prg.actions.push("presetData");
											}
											prg.actions.push("enable");
											prg.max += 1;
											setDisableButtons(false);
											setProgress(prg);
										}}
									>
										{textData.Confirm}
									</AlertDialogCancel>
								</div>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				)}
				{progress.started && (
					<div className="w-full min-h-[calc(100vh-14rem)] flex flex-col items-center justify-center">
						{progress.actions.map((action, index) => (
							<div
								key={action}
								className="flex duration-300 flex-col items-center w-full"
								style={{
									marginTop: index == 0 ? progress.actions.length * 3 - progress.index * 5 + "rem" : "",
								}}
							>
								<div
									className="flex duration-300 items-center gap-2"
									style={{ opacity: index <= progress.index ? 1 : 0.25 }}
								>
									<CheckCircleIcon
										className="w-4 h-4 text-accent duration-200 -ml-4"
										style={{ opacity: index < progress.index ? 1 : 0 }}
									/>
									<CircleIcon
										className="w-4 h-4 animate-pulse duration-200 -ml-6"
										style={{ color: index == progress.index ? "var(--accent)" : "#0000" }}
									/>
									<Label className="text-lg">{dict[action as keys].action}</Label>
								</div>
								<div
									className="duration-300 h-auto overflow-hidden"
									style={{
										height: index == progress.index ? "3rem" : "0px",
									}}
								>
									<Button
										disabled={index !== progress.index || disableButtons}
										onClick={async () => {
											setDisableButtons(true);
											try {
												switch (action) {
													case "data":
														await exportConfig(settings, textData);
														break;
													case "modData":
														await remSaveModData();
														break;
													case "presetData":
														await remSavePresets();
														break;
													case "enable":
														await remMoveMods(removeSettings.category == "1", parseInt(removeSettings.enable) - 1);
														break;
												}
												setProgress((prev) => ({ ...prev, index: prev.index + 1 }));
											} catch (error) {
												console.error("Error during action:", action, error);
											}
											setDisableButtons(false);
										}}
									>
										{disableButtons && index == progress.index
											? dict[action as keys].doing
											: dict[action as keys].button}
									</Button>
								</div>
							</div>
						))}
						<div
							className="fixed z-10 w-full duration-300 h-full items-center justify-center bg-background/80 backdrop-blur-2xl top-0 flex flex-col"
							style={{
								opacity: progress.index == progress.max ? 1 : 0,
								pointerEvents: progress.index == progress.max ? "auto" : "none",
							}}
						>
							<div className=" my-6 text-accent text-3xl" >{textData.Thanks}</div>
							<div id="reloadTimer">
								{textData.AppRL.replace("<s/>", "5")}
							</div>
						</div>
						<div className="absolute left-10 bottom-10">
							<Button
								onClick={() => {
									setProgress((prev) =>
										prev.index == 0 ? { ...prev, started: false } : { ...prev, index: prev.index - 1 }
									);
								}}
							>
								<ChevronLeftIcon className="w-4 h-4 -ml-1" /> {textData.Back}
							</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

export default Remove;

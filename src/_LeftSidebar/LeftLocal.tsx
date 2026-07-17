import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SidebarContent, SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { applyPreset, refreshModList, saveConfigs } from "@/utils/filesys";
import { CURRENT_PRESET, FILTER, LEFT_SIDEBAR_OPEN, MOD_LIST, PRESETS, TEXT_DATA } from "@/utils/vars";
import { Separator } from "@radix-ui/react-separator";
import { useAtom, useAtomValue } from "jotai";
import { CheckIcon, CircleIcon, EditIcon, PlusIcon, SaveIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useMemo } from "react";
let focusedPreset = -1;
function LeftLocal() {
	const leftSidebarOpen = useAtomValue(LEFT_SIDEBAR_OPEN);
	const textData = useAtomValue(TEXT_DATA);
	const [filter, setFilter] = useAtom(FILTER);
	const [presets, setPresets] = useAtom(PRESETS);
	const [currentPreset, setCurrentPreset] = useAtom(CURRENT_PRESET);
	const [modList, setModList] = useAtom(MOD_LIST);
	const updatePreset = (index: number, name: string, shouldSave = false, shouldDelete = false) => {
		const tempPresets = [...presets];
		let wasCreated = false;
		if (index === tempPresets.length) {
			tempPresets.push({ name, data: [], hotkey: "" });
			wasCreated = true;
		}
		let counter = 1;
		let orgName = name;
		while (tempPresets.find((p, i) => p.name === name && i !== index)) {
			name = `${orgName} (${counter++})`;
		}
		tempPresets[index].name = name;

		if (shouldSave) {
			tempPresets[index].data = [];
			for (let mod of modList) {
				if (mod.enabled) {
					tempPresets[index].data.push(mod.path);
				}
			}
		}

		if (shouldDelete) {
			tempPresets.splice(index, 1);
			if (currentPreset === index) {
				setCurrentPreset(-1);
			} else if (currentPreset > index) {
				setCurrentPreset(currentPreset - 1);
			}
		} else if (wasCreated) {
			setCurrentPreset(index);
		}

		setPresets(tempPresets);

		if (wasCreated) {
			setCurrentPreset(index);
			focusedPreset = index;
		}

		saveConfigs();
	};
	const filterParams = [
		{
			key: "src",
			sub: "",
			label: textData.Source,
		},
		{
			key: "upd",
			sub: "",
			label: textData.Update,
		},
		{
			key: "tag",
			sub: "fav",
			label: textData.Favorite,
		},
		{
			key: "tag",
			sub: "nsfw",
			label: textData.NSFW,
		},
	];
	const filterFunction = useCallback(
		(key: string, val: string, subkey = "", reset = false) => {
			setFilter((prev: any) => {
				if (reset) {
					filterParams.forEach((item) => {
						if (item.sub) {
							prev[item.key][item.sub] = "any";
						} else {
							prev[item.key] = "any";
						}
					});
				}
				if (subkey && (reset || prev[key][subkey] !== val)) {
					prev[key][subkey] = val;
				} else if (!subkey && (reset || prev[key] !== val)) {
					prev[key] = val;
				} else {
					return prev;
				}
				return { ...prev };
			});
		},
		[filter, setFilter, filterParams]
	);
	const activeFilters = useMemo(() => {
		return Object.keys(filter).some((key) => {
			if (key === "st") return false;
			if (typeof filter[key as keyof typeof filter] === "string") {
				if (filter[key as keyof typeof filter] !== "any") return true;
			} else {
				if (Object.values(filter[key as keyof typeof filter] as Record<string, string>).some((v) => v !== "any"))
					return true;
			}
			return false;
		});
	}, [filter]);

	return (
		<>
			<SidebarGroup className=" p-0">
				<SidebarGroupLabel className="justify-between">
					{textData.Filter}
					<Dialog>
						<DialogTrigger>
							<div
								className="min-w-fit px-1 rounded hover:text-accent cursor-pointerx active:scale-95 text-accent/50 text-xs duration-200 select-none"
								style={{
									background: activeFilters ? "var(--accent)" : "",
									color: activeFilters ? "var(--background)" : "",
								}}
							>
								{textData.Advanced}
							</div>
						</DialogTrigger>
						<DialogContent className="max-h-120 min-h-120">
							<div className="min-h-fit text-accent my-6 text-3xl">
								{textData.AdvFilOpt}
								<Tooltip>
									<TooltipTrigger></TooltipTrigger>
									<TooltipContent className="opacity-0"></TooltipContent>
								</Tooltip>
							</div>

							<div className="flex flex-row mb-8 gap-4 items-center">
								{[
									{
										icon: <CircleIcon className="aspect-square h-4 text-accent" />,
										text: textData.FilterAll,
									},
									{
										icon: <CheckIcon className="aspect-square h-4 text-success" />,
										text: textData.Yes,
									},
									{
										icon: <XIcon className="aspect-square h-4 text-destructive" />,
										text: textData.No,
									},
								].map((fil) => (
									<div key={fil.text} className="flex flex-row gap-1 items-center">
										{fil.icon}
										<label>{fil.text}</label>
									</div>
								))}
							</div>
							<div className="flex flex-row gap-4 items-center">
								<label className="min-w-24 text-center">{textData.Enabled}</label>
								<div className="flex flex-row gap-1 w-full">
									{[
										{
											val: "all",
											icon: <CircleIcon className="aspect-square h-4" />,
										},
										{
											val: "enabled",
											icon: <CheckIcon className="aspect-square h-4" />,
										},
										{
											val: "disabled",
											icon: <XIcon className="aspect-square h-4" />,
										},
									].map((fil) => (
										<Button
											key={"filter " + fil.val}
											onClick={() => {
												filterFunction("st", fil.val);
											}}
											className={
												"w-25 data-zzz:text-xs " + (filter.st == fil.val ? "bg-accent bgaccent text-background " : "")
											}
											style={{ width: leftSidebarOpen ? "" : "2.5rem" }}
										>
											{fil.icon}
										</Button>
									))}
								</div>
							</div>
							{filterParams.map((item) => {
								return (
									<div className="flex flex-row gap-4 items-center">
										<label className="min-w-24 text-center">{item.label}</label>
										<div className="flex flex-row gap-1 w-full">
											{[
												{
													val: "any",
													icon: <CircleIcon className="aspect-square h-4" />,
												},
												{
													val: "has",
													icon: <CheckIcon className="aspect-square h-4" />,
												},
												{
													val: "lacks",
													icon: <XIcon className="aspect-square h-4" />,
												},
											].map((fil) => (
												<Button
													key={"filter " + fil.val}
													onClick={() => {
														filterFunction(item.key, fil.val, item.sub);
													}}
													className={
														"w-25 data-zzz:text-xs " +
														((item.sub
															? (filter[item.key as keyof typeof filter] as Record<string, string>)[item.sub]
															: filter[item.key as keyof typeof filter]) === fil.val
															? "bg-accent bgaccent text-background "
															: "")
													}
													style={{ width: leftSidebarOpen ? "" : "2.5rem" }}
												>
													{fil.icon}
												</Button>
											))}
										</div>
									</div>
								);
							})}
						</DialogContent>
					</Dialog>
				</SidebarGroupLabel>
				<SidebarContent
					className="flex flex-row items-center justify-between w-full gap-2 px-2 overflow-hidden"
					style={{
						flexDirection: leftSidebarOpen ? "row" : "column",
					}}
				>
					{[
						{
							name: "all",
							icon: <CircleIcon className="aspect-square h-4" />,
							text: textData.All,
						},
						{
							name: "enabled",
							icon: <CheckIcon className="aspect-square h-4" />,
							text: textData.Enabled,
						},
						{
							name: "disabled",
							icon: <XIcon className="aspect-square h-4" />,
							text: textData.Disabled,
						},
					].map((fil) => (
						<Button
							key={"filter " + fil.name}
							onClick={() => {
								filterFunction("st", fil.name, "", true);
							}}
							className={
								"w-25 data-zzz:text-xs " +
								(filter.st == fil.name && !activeFilters ? "bg-accent bgaccent text-background " : "")
							}
							style={{ width: leftSidebarOpen ? "" : "2.5rem" }}
						>
							{fil.icon}
							{leftSidebarOpen && fil.text}
						</Button>
					))}
				</SidebarContent>
			</SidebarGroup>
			<Separator
				className="w-full ease-linear duration-200 min-h-[0.0625rem] my-2.5 bg-border"
				style={{
					opacity: leftSidebarOpen ? "0" : "",
					height: leftSidebarOpen ? "0px" : "",
					marginBlock: leftSidebarOpen ? "0.25rem" : "",
				}}
			/>
			<SidebarGroup className="">
				<SidebarGroupLabel className="flex items-center justify-between">
					{textData.Presets}

					<div
						onClickCapture={async () => {
							setCurrentPreset(-1);
							applyPreset([]);
							setModList(await refreshModList());
						}}
						className="min-w-fit hover:text-accent cursor-pointerx active:scale-95 text-accent/50 text-xs duration-200 select-none"
					>
						{textData.DisableAll}
					</div>
				</SidebarGroupLabel>
				<SidebarContent className="justify-evenly flex items-center w-full gap-0 overflow-hidden">
					<div
						className="min-w-14 thin justify-evenly flex flex-col items-center w-full gap-2 pl-2 overflow-hidden overflow-y-scroll duration-200"
						style={{
							maxHeight: leftSidebarOpen ? "calc(100vh - 33.5rem)" : "calc(100vh - 37.5rem)",
						}}
					>
						<AnimatePresence initial={false}>
							{presets.length > 0 || !leftSidebarOpen ? (
								presets.map((preset, index) => (
									<motion.div
										initial={{ opacity: 0, marginBottom: "-2.5rem" }}
										animate={{ opacity: 1, marginBottom: "0rem" }}
										exit={{ opacity: 0, marginBottom: "-3rem" }}
										key={preset?.name}
										layout
										transition={{ duration: 0.2 }}
										className="min-h-10 flex group justify-center w-full"
										onClick={async (e) => {
											if (e.target == e.currentTarget) {
												setCurrentPreset(index);
												await applyPreset(preset?.data, preset?.name);
												setModList(await refreshModList());
											}
										}}
										style={{
											height: leftSidebarOpen ? "" : "2.5rem",
											width: leftSidebarOpen ? "" : "2.5rem",
											padding: leftSidebarOpen ? "" : "0px",
										}}
									>
										{leftSidebarOpen ? (
											<div
												className={
													"w-full text-accent button-like duration-200 rounded-lg px-2  items-center flex gap-1 " +
													(currentPreset == index
														? " bg-accent bgaccent text-background"
														: "zzz-fg-text bg-input/10 hover:bg-input/20")
												}
												onClick={(e) => e.currentTarget.parentElement?.click()}
												style={{
													transitionProperty: "background-color, border-radius",
												}}
											>
												<Input
													autoFocus={index === focusedPreset}
													onFocus={(e) => {
														e.currentTarget.select();
														focusedPreset = index;
													}}
													onBlur={(e) => {
														if (e.currentTarget.value !== preset.name) {
															focusedPreset = -1;
															updatePreset(index, e.currentTarget.value);
														}
													}}
													type="text"
													className="w-full h-full p-2  pointer-events-none focus-within:pointer-events-auto overflow-hidden focus-visible:ring-[0px] border-0  text-ellipsis"
													style={{ backgroundColor: "#fff0" }}
													defaultValue={preset?.name}
												/>
												<EditIcon
													onClick={(e) => {
														let prev = e.currentTarget.previousSibling as HTMLInputElement;
														prev?.focus();
													}}
													className="scale-75 pointer-events-auto"
												/>
												<XIcon
													onClick={() => {
														updatePreset(index, preset.name, false, true);
													}}
													className=" pointer-events-auto"
												/>
											</div>
										) : (
											<Button className="w-full h-full">{index + 1}</Button>
										)}
									</motion.div>
								))
							) : (
								<motion.div
									initial={{ opacity: 0, height: "0px" }}
									animate={{ opacity: 1, height: "2.5rem" }}
									key="loner"
									className="text-foreground/50 flex items-center justify-center w-64 h-10 overflow-hidden text-center duration-200 ease-linear"
									style={{
										opacity: leftSidebarOpen ? "" : "0",
										scale: leftSidebarOpen ? "" : "0",
										height: leftSidebarOpen ? "" : "0px",
									}}
								>
									{textData.Empty}
								</motion.div>
							)}
						</AnimatePresence>
					</div>
					<div
						className="flex items-center justify-between w-full gap-2 px-2 mt-2"
						style={{
							flexDirection: leftSidebarOpen ? "row" : "column",
						}}
					>
						<Button
							className="w-38.75"
							style={{ width: leftSidebarOpen ? "" : "2.5rem" }}
							onClick={() => {
								const presetLength = presets.length;
								updatePreset(presetLength, `Preset${presetLength + 1}`, true);
							}}
						>
							<PlusIcon className="w-6 h-6" />
							<label
								className="duration-200 ease-linear"
								style={{
									opacity: leftSidebarOpen ? "" : "0",
									width: leftSidebarOpen ? "2.5rem" : "0rem",
									marginRight: leftSidebarOpen ? "" : "-0.5rem",
								}}
							>
								{textData.New}
							</label>
						</Button>
						<Button
							onClick={(e) => {
								if (currentPreset == -1) {
									let prev = e.currentTarget.previousElementSibling as HTMLButtonElement;
									prev?.click();
								} else {
									updatePreset(currentPreset, presets[currentPreset].name, true);
								}
							}}
							className="w-38.75"
							style={{ width: leftSidebarOpen ? "" : "2.5rem" }}
						>
							<SaveIcon className="w-6 h-6" />
							<label
								className="duration-200 ease-linear"
								style={{
									opacity: leftSidebarOpen ? "" : "0",
									width: leftSidebarOpen ? "2.5rem" : "0rem",
									marginRight: leftSidebarOpen ? "" : "-0.5rem",
								}}
							>
								{textData.Save}
							</label>
						</Button>
					</div>
				</SidebarContent>
			</SidebarGroup>
		</>
	);
}

export default LeftLocal;

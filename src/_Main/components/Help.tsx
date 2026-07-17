import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { GAME, HELP_OPEN, TEXT_DATA } from "@/utils/vars";
import { useAtom, useAtomValue } from "jotai";
import { ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import CarouselTut from "./CarouselTut";
import { AnimatePresence, motion } from "motion/react";
import {Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function Help() {
	const textData = useAtomValue(TEXT_DATA);
	const data = [
		["SwitchGames", textData.title, textData.content],
		["ToggleMods", textData.ToggleModstitle, textData.ToggleModscontent],
		["DeleteMod", textData.DeleteModtitle, textData.DeleteModcontent],
		["EditModInfo", textData.EditModInfotitle, textData.EditModInfocontent],
		["EditModConfig", textData.EditModConfigtitle, textData.EditModConfigcontent],
		["ChangeImg", textData.ChangeImgtitle, textData.ChangeImgcontent],
		["OpenExp", textData.OpenExptitle, textData.OpenExpcontent],
		["PasteLink", textData.PasteLinktitle, textData.PasteLinkcontent],
		["OpenLink", textData.OpenLinktitle, textData.OpenLinkcontent],
		["OnlineMode", textData.OnlineModetitle, textData.OnlineModecontent],
		["UsingPresets", textData.UsingPresetstitle, textData.UsingPresetscontent],
		["SearchMods", textData.SearchModstitle, textData.SearchModscontent],
		["DLMods", textData.DLModstitle, textData.DLModscontent],
		["UpdateMods", textData.UpdateModstitle, textData.UpdateModscontent],
		["ManualInstall", textData.ManualInstalltitle, textData.ManualInstallcontent],
		["ConflictRes", textData.ConflictRestitle, textData.ConflictRescontent],
		["ManageCats", textData.ManageCatstitle, textData.ManageCatscontent],
		["BatchOps", textData.BatchOpstitle, textData.BatchOpscontent],
		["Restore", textData.Restoretitle, textData.Restorecontent],
		["Settings", textData.Settingstitle, textData.Settingscontent],
		["Updater", textData.Updatertitle, textData.Updatercontent],
		["RemoveIMM", textData.RemoveIMMtitle, textData.RemoveIMMcontent],
	] as const;
	const keys = data.map(([key]) => key);
	const [helpOpen, setHelpOpen] = useAtom(HELP_OPEN);
	const [selectedItem, setSelectedItem] = useState(-1);
	const [subIndex, setSubIndex] = useState(0);
	useEffect(() => {
		setSubIndex(0);
	}, [selectedItem]);
	const game = useAtomValue(GAME);
	return (
		<Dialog open={helpOpen} onOpenChange={setHelpOpen}>
			<DialogTrigger asChild>
				<Button disabled={helpOpen} className="bg-sidebar flex gap-0.5 h-5 pointer-events-auto p-0 px-1 text-[0.625rem] border">
					<HelpCircle className="py-[0.0625rem]" />
					{textData.Help}
				</Button>
			</DialogTrigger>
			<DialogContent className="game-font h-200 max-h-[calc(100vh-4rem)] min-w-260 flex flex-col gap-8">
				<div className="min-h-fit text-accent mt-6 text-3xl">
					{textData.Tutorials}
					<Tooltip>
						<TooltipTrigger></TooltipTrigger>
						<TooltipContent className="opacity-0"></TooltipContent>
					</Tooltip>
				</div>
				<div className="w-250  h-161 flex gap-12 overflow-hidden">
					<div className="min-w-82 flex flex-col h-full gap-2 overflow-hidden">
						{/* <Input placeholder="Search..." /> */}
						<div className="w-82 data-wuwa:border data-wuwa:gap-0 data-wuwa:pr-0 flex flex-col h-full gap-1 pr-1 overflow-x-hidden overflow-y-auto border-0 rounded-sm">
							{data.map(([key, title], index) => (
								<Button
									key={key}
									onClick={() => setSelectedItem((prev) => (prev === index ? -1 : index))}
									className={"w-full h-10 bgaccent text-muted-foreground"}
									style={{
										backgroundColor:
											game == "WW"
												? selectedItem === index
													? "var(--border)"
													: index % 2 == 0
													? "#1b1b1b50"
													: "#31313150"
												: selectedItem === index
												? "var(--accent)"
												: "",
										color: game !== "WW" && selectedItem === index ? "var(--background)" : "",
										animation: game !== "WW" && selectedItem === index ? "" : "none",
									}}
								>
									{title}
								</Button>
							))}
						</div>
					</div>
					<div className="flex flex-col justify-center w-full h-full">
						<AnimatePresence mode="wait">
							{selectedItem > -1 ? (
								<motion.div
									key={keys[selectedItem]}
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 1.05 }}
									className="flex flex-col justify-center w-full h-full"
								>
									<CarouselTut
										subIndex={subIndex}
										setSubIndex={setSubIndex}
										data={data[selectedItem]?.[2]}
										title={keys[selectedItem]}
									/>
								</motion.div>
							) : (
								<>
									<motion.div
										className="text-muted-foreground pointer-events-none gap-4 fixed flex flex-col items-center justify-center w-160 h-full"
										key="empty"
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 1.05 }}
									>
										<div className="logo min-h-60 min-w-60 brightness-50 mb-4"></div>
									</motion.div>
								</>
							)}
						</AnimatePresence>
					</div>
				</div>
				<div className="flex w-full h-10 -mt-12">
					<div className="min-w-94" />
					<div className="flex justify-between w-full">
						<Button
							className=" min-w-28"
							disabled={selectedItem <= 0 && subIndex === 0}
							onClick={() => {
								if (subIndex === 0) {
									setSelectedItem((prev) => prev - 1);
								} else {
									setSubIndex((prev) => prev - 1);
								}
							}}
						>
							<ChevronLeft className="-ml-2" /> {textData.Prev}
						</Button>
						<Button
							className="min-w-28"
							disabled={
								selectedItem === keys.length - 1 &&
								data[selectedItem]?.[2].length - 1 === subIndex
							}
							onClick={() => {
								if (
									selectedItem < 0 ||
									data[selectedItem]?.[2].length - 1 === subIndex
								) {
									setSelectedItem((prev) => prev + 1);
									setSubIndex(0);
								} else {
									setSubIndex((prev) => prev + 1);
								}
							}}
						>
							{textData.Next} <ChevronRight className="-mr-2" />
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default Help;

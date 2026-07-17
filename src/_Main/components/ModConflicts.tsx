import CardLocal from "@/_Main/components/CardLocal";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toggleMod } from "@/utils/filesys";

import { CONFLICT_INDEX, CONFLICTS, MOD_LIST, TEXT_DATA } from "@/utils/vars";

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

function ModConflicts() {
	const setModList = useSetAtom(MOD_LIST);
	const { conflicts } = useAtomValue(CONFLICTS);
	const [curIndex, setCurIndex] = useAtom(CONFLICT_INDEX);
	const [curSelected, setCurSelected] = useState(-1);
	const [nextSide, setNextSide] = useState<"left" | "right">("right");
	const textData = useAtomValue(TEXT_DATA);
	useEffect(() => {
		setCurSelected(-1);
	}, [curIndex]);
	return (
		<DialogContent>
			<Tooltip>
				<TooltipTrigger></TooltipTrigger>
				<TooltipContent className="opacity-0"></TooltipContent>
			</Tooltip>

			<div className="min-h-fit text-accent mt-6 text-3xl">{textData.ResModConf}</div>
			<AnimatePresence mode="wait">
				{conflicts.length > 0 ? (
					<motion.div
						className="max-h-100 relative min-h-100 flex flex-col w-full h-full p-2 pt-6 overflow-x-hidden overflow-y-scroll text-gray-300 rounded-sm"
						key={conflicts[curIndex][0]}
						initial={{
							opacity: 0,
							left: nextSide === "right" ? "10%" : "-10%",
						}}
						animate={{
							opacity: 1,
							left: 0,
						}}
						exit={{
							opacity: 0,
							left: nextSide === "right" ? "-10%" : "10%",
						}}
						transition={{
							duration: 0.3,
							ease: "easeInOut",
						}}
					>
						<div className="min-h-fit flex flex-row flex-wrap gap-10 justify-center w-full py-4">
							{conflicts[curIndex]?.map((path, idx) => (
								<div
									onClick={(e) => {
										e.preventDefault();
										setCurSelected((prev) => (prev === idx ? -1 : idx));
									}}
									onContextMenu={(e) => {
										e.preventDefault();
										setCurSelected((prev) => (prev === idx ? -1 : idx));
									}}
								>
									<CardLocal
										item={{
											path,
											name: path.split(/[/\\]/).pop() || path,
											enabled: curSelected === -1 ? true : curSelected === idx,
											isDir: false,
										}}
										selected={curSelected === idx}
										lastUpdated={0}
										hasUpdate={false}
										updateAvl={""}
										key={idx}
										inConflict={0}
									/>
								</div>
							))}
						</div>
					</motion.div>
				) : (
					<motion.div
						className="text-center w-full h-100 justify-center items-center flex text-gray-400"
						key="no-conflict"
						initial={{
							opacity: 0,
							scale: 1.1,
						}}
						animate={{
							opacity: 1,
							scale: 1,
						}}
						exit={{
							opacity: 0,
							scale: 0.9,
						}}
						transition={{
							duration: 0.3,
							ease: "easeInOut",
						}}
					>
						{textData.NoConf}
					</motion.div>
				)}
			</AnimatePresence>
			<div
				className="flex w-full justify-between"
				style={{
					opacity: conflicts.length > 0 ? "1" : "0",
					pointerEvents: conflicts.length > 0 ? "auto" : "none",
				}}
			>
				<Button
					disabled={curIndex <= 0}
					onClick={() => {
						if (curIndex > 0) {
							let newIndex = curIndex - 1;
							setNextSide("left");
							setTimeout(() => {
								setCurIndex(newIndex);
							}, 50);
						}
					}}
					className="min-w-24"
				>
					{textData.Prev}
				</Button>
				<div className="w-full text-xs text-muted-foreground flex flex-col items-center justify-center">
					<div className="flex flex-row text-accent gap-1 mb-2 text-sm items-center justify-center px-10 w-full">
						{conflicts?.map((c, i) => (
							<div
								key={c[0]}
								className={`w-2.5 h-2.5 rounded-full cursor-pointer duration-200 ${
									i === curIndex ? "bg-accent" : "border hover:bg-muted"
								}`}
								onClick={() => {
									setNextSide(i < curIndex ? "left" : "right");
									setTimeout(() => {
										setCurIndex(i);
									}, 50);
								}}
							></div>
						))}
					</div>
					<div>{textData.Msg1}</div>
					<div>{textData.Msg2}</div>
				</div>
				<Button
					disabled={curIndex >= conflicts.length - 1 && curSelected === -1}
					onClick={async () => {
						let toDisable: any =
							curSelected < 0 ? [] : [...conflicts[curIndex]].filter((_, idx) => idx !== curSelected);

						if (toDisable.length > 0) {
							const promises = toDisable.map((path: string) => toggleMod(path, false));
							await Promise.all(promises);
							toDisable = new Set(toDisable);
							setNextSide("right");
							setCurSelected(-1);
							setModList((old) =>
								old.map((mod) => ({
									...mod,
									enabled: toDisable.has(mod.path) ? false : mod.enabled,
								}))
							);
						} else if (curIndex < conflicts.length - 1) {
							let newIndex = curIndex + 1;
							setNextSide("right");
							setTimeout(() => {
								setCurIndex(newIndex);
							}, 50);
						}
					}}
					className="min-w-24"
				>
					{curSelected >= 0 ? textData.Resolve : textData.Skip}
				</Button>
			</div>
		</DialogContent>
	);
}

export default ModConflicts;

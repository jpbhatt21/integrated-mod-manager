import { Button } from "@/components/ui/button";
import { UNCATEGORIZED } from "@/utils/consts";
import { CATEGORIES, CATEGORY, MOD_LIST, ONLINE, ONLINE_PATH, ONLINE_SORT, ONLINE_TYPE, TEXT_DATA } from "@/utils/vars";
import { useAtom, useAtomValue } from "jotai";
import { ChevronUpIcon, FileQuestionIcon, GroupIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

function BottomBar() {
	const textData = useAtomValue(TEXT_DATA);
	const [category, setCategory] = useAtom(CATEGORY);
	const [onlinePath, setOnlinePath] = useAtom(ONLINE_PATH);
	const onlineType = useAtomValue(ONLINE_TYPE);
	const onlineSort = useAtomValue(ONLINE_SORT);
	const online = useAtomValue(ONLINE);
	const modList = useAtomValue(MOD_LIST);
	const categories = useAtomValue(CATEGORIES);
	const [expanded, setExpanded] = useState(false);
	const localCategories = useMemo(() => {
		// info("Online Path:", onlinePath);
		return online
			? categories.filter((_, index) =>
					["Weapons", "Bows", "Catalysts", "Claymores", "Polearms", "Swords"].includes(
						onlinePath.split("&_")[0].split("/").pop() as string
					)
						? index >= categories.findIndex((c) => c._sName == "Bows") &&
							index <= categories.findIndex((c) => c._sName == "Swords")
						: true
				)
			: [
					{ _sName: "All", _sIconUrl: "/icons/all.png", _special: true },
					...(modList.some((mod) => mod.parent == UNCATEGORIZED)
						? [{ _sName: UNCATEGORIZED, _sIconUrl: "/icons/uncategorized.png", _special: true }]
						: []),
					...categories.filter((cat) => modList.some((mod) => mod.parent == cat._sName)),
				];
	}, [categories, modList, online, onlinePath]);
	console.log(onlinePath)
	return (
		<div
			className="min-h-20 duration-200 flex items-center justify-center w-full h-20 p-2"
			style={{
				height: expanded ? "16rem" : "",
			}}
		>
			<div className="bg-sidebar data-zzz:rounded-[3rem] data-gi:rounded-[3rem] z-100 text-accent flex items-center justify-center w-full h-full gap-1 p-2 border rounded-lg">
				<label className="min-w-fit zzz-fg-text gap-1">{textData.Category} :</label>
				<div
					onWheel={(e) => {
						if (e.deltaX != 0) return;
						let target = e.currentTarget as HTMLDivElement;
						target.scrollTo({
							left: target.scrollLeft + e.deltaY,
							// behavior: "smooth",
						});
					}}
					style={{
						flexWrap: expanded ? "wrap" : "nowrap",
						overflowY: expanded ? "auto" : "hidden",
						overflowX: expanded ? "hidden" : "auto",
					}}
					className=" min-h-15 h-full items-top thin flex items-center justify-start w-full gap-2 p-2 my-1 mr-1 overflow-x-auto overflow-y-hidden text-white"
				>
					<AnimatePresence mode="popLayout">
						{localCategories.map((cat) => (
							<motion.div
								initial={{ opacity: 0, y: "100%" }}
								animate={{ opacity: 1, y: "0%" }}
								exit={{ opacity: 0, y: "100%" }}
								key={cat._sName + " " + expanded}
								layout
							>
								<Button
									key={cat._sName}
									onClick={(e) => {
										//check if control is pressed
										const ctrl = e.ctrlKey || e.metaKey;
										if (online) {
											if (cat._special) {
												return;
											}
											if (onlinePath.split("&_").shift() === `Skins/${cat._sName}`) {
												setOnlinePath("home&_type=" + onlineType);
												return;
											}
											setOnlinePath(`Skins/${cat._sName}&_sort=${onlineSort}`);
										} else {
											setCategory((prev) => {
												if (ctrl) {
													if (cat._sName === "All") return prev;
													if (prev.has(cat._sName)) {
														const newSet = new Set(prev);
														newSet.delete(cat._sName);
														return newSet;
													}
													return new Set(prev).add(cat._sName);
												} else {
													return (prev.has(cat._sName) && prev.size == 1) || cat._sName === "All"
														? new Set()
														: new Set([cat._sName]);
												}
											});
										}
									}}
									style={{
										scale: online && cat._special ? "0" : "1",
										marginRight: online && cat._special ? "-9.5rem" : "0rem",
										padding: online && cat._special ? "0rem" : "",
									}}
									className={
										" data-zzz:rounded-lg " +
										((
											online
												? onlinePath.split("&_").shift() === `Skins/${cat._sName}`
												: (cat._sName == "All" && category.size == 0) || category.has(cat._sName)
										)
											? " bg-accent bgaccent    text-background"
											: "")
									}
								>
									{cat._sName == "All" ? (
										<>
											<GroupIcon className="aspect-square h-full pointer-events-none" />
											<span className="">{textData.All}</span>
										</>
									) : cat._sName == UNCATEGORIZED ? (
										<>
											<FileQuestionIcon className="aspect-square h-full pointer-events-none" />
											<span className="">{textData.Uncategorized}</span>
										</>
									) : (
										<>
											<img
												className="aspect-square min-w-6 scale-120 h-full rounded-full pointer-events-none"
												onError={(e) => {
													e.currentTarget.src = "/who.jpg";
												}}
												src={cat._sIconUrl || "err"}
											/>
											<span className="">{cat._sName}</span>
										</>
									)}
								</Button>
							</motion.div>
						))}
					</AnimatePresence>
				</div>
				<Button
					onClick={() => {
						setExpanded((prev) => !prev);
					}}
				>
					<ChevronUpIcon
						className=" h-5 w-5 duration-200 pointer-events-none"
						style={{
							transform: expanded ? "rotate(180deg)" : "",
						}}
					/>
				</Button>
			</div>
		</div>
	);
}

export default BottomBar;

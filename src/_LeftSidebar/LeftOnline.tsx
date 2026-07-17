import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SidebarContent, SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";
import { modRouteFromURL } from "@/utils/utils";
import {
	GAME,
	INSTALLED_ITEMS,
	LEFT_SIDEBAR_OPEN,
	ONLINE_PATH,
	ONLINE_SELECTED,
	ONLINE_SORT,
	ONLINE_TYPE,
	RIGHT_SLIDEOVER_OPEN,
	TEXT_DATA,
	TYPES,
} from "@/utils/vars";
import { Separator } from "@radix-ui/react-separator";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
	AppWindowIcon,
	BotIcon,
	EyeIcon,
	FolderCheckIcon,
	ShieldQuestion,
	ShirtIcon,
	ShoppingBagIcon,
	SwordsIcon,
	UploadIcon,
	UserIcon,
	VenetianMaskIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { JSX } from "react";

const iconMap: { [key: string]: JSX.Element } = {
	Skin: <ShirtIcon className="w-6 h-6" />,
	Characters: <UserIcon className="w-6 h-6" />,
	Operators: <UserIcon className="w-6 h-6" />,
	Bangboo: <BotIcon className="w-6 h-6" />,
	UI: <AppWindowIcon className="w-6 h-6" />,
	Other: <ShieldQuestion className="w-6 h-6" />,
	Weapons: <SwordsIcon className="w-6 h-6" />,
	Objects: <ShoppingBagIcon className="w-6 h-6" />,
	Entity: <VenetianMaskIcon className="w-6 h-6" />,
};
function LeftOnline() {
	const textData = useAtomValue(TEXT_DATA);
	const leftSidebarOpen = useAtomValue(LEFT_SIDEBAR_OPEN);
	const types = useAtomValue(TYPES);
	const onlineType = useAtomValue(ONLINE_TYPE);
	const [onlinePath, setOnlinePath] = useAtom(ONLINE_PATH);
	const onlineSort = useAtomValue(ONLINE_SORT);
	const installedItems = useAtomValue(INSTALLED_ITEMS);
	const setSelected = useSetAtom(ONLINE_SELECTED);
	const setRightSlideOverOpen = useSetAtom(RIGHT_SLIDEOVER_OPEN);
	const game = useAtomValue(GAME);
	return (
		<>
			<div
				className=" thin flex shrink-0 flex-col w-full p-0 overflow-hidden"
				style={{
					maxHeight: leftSidebarOpen ? "" : "calc(100vh - 29.66rem)",
					minHeight: leftSidebarOpen ? "fit-content" : "",
				}}
			>
				<SidebarGroupLabel>{textData.Type}</SidebarGroupLabel>
				<SidebarContent
					className="min-h-fit grid items-center justify-center w-full grid-cols-2 px-2"
					style={{
						gridTemplateColumns: leftSidebarOpen ? game=="WW"?"repeat(3, minmax(0, 1fr))":"" : "repeat(1, minmax(0, 1fr))",
					}}
				>
					{types.map((category) => {
						return (
							<div className="flex items-center justify-center w-full">
								<Button
									key={"filter" + category._sName}
									id={"type " + category._sName}
									onClick={() => {
										if (onlinePath.startsWith(category._sName)) {
											setOnlinePath("home&_type=" + onlineType);
											return;
										}
										setOnlinePath(`${category._sName}&_sort=${onlineSort}`);
									}}
									className={
										"w-full min-w-fit justify-start	 " +
										(onlinePath.startsWith(category._sName) && " bg-accent bgaccent   text-background")
									}
									style={{
										width: leftSidebarOpen ? "" : "2.5rem",
										paddingInline: leftSidebarOpen ? "" : "0.25rem",
										justifyContent: leftSidebarOpen ? "start" : "center",
									}}
								>
									{game == "GI" ? (
										<img
											src={category._sIconUrl}
											className="aspect-square w-8 h-8 duration-200"
											style={{
												filter: onlinePath.startsWith(category._sName) ? "invert(1) hue-rotate(180deg)" : "",
											}}
										/>
									) : (
										iconMap[category._sName] || <ShieldQuestion className="w-6 h-6" />
									)}

									{leftSidebarOpen && <label className="w-full text-center"> {category._sName}</label>}
								</Button>
							</div>
						);
					})}
				</SidebarContent>
			</div>
			<Separator
				className="w-full ease-linear duration-200 min-h-[0.0625rem] border-b my-2.5"
				style={{
					opacity: leftSidebarOpen ? "0" : "",
					height: leftSidebarOpen ? "0px" : "",
					marginBlock: leftSidebarOpen ? "0.25rem" : "",
				}}
			/>
			<SidebarGroup
				className="flex flex-col flex-1 min-h-0 pr-1 overflow-hidden"
				style={{
					height: leftSidebarOpen ? "" : "9rem",
				}}
			>
				<SidebarGroupLabel className="flex items-center gap-1">
					{textData.Installed}{" "}
					<Label className="text-accent min-w-fit flex text-xs scale-75 opacity-50">
						<UploadIcon className="min-h-2 min-w-2 w-4 h-4" />{" "}
						{installedItems.filter((item) => item.modStatus === 2).length} <span> | </span>
						<EyeIcon className="min-h-2 min-w-2 w-4 h-4" />
						{installedItems.filter((item) => item.modStatus === 1).length}
						<span> | </span>
						<FolderCheckIcon className="min-h-2 min-w-2 w-4 h-4" />
						{installedItems.filter((item) => item.modStatus === 0).length}
					</Label>
					
				</SidebarGroupLabel>
				<SidebarContent className="min-w-14 flex flex-col items-center w-full h-full gap-2 pl-2 pr-1 mb-2 overflow-hidden overflow-y-auto duration-200">
					<AnimatePresence initial={false}>
						{leftSidebarOpen ? (
							<>
								{installedItems.map((item, index) => (
									<motion.div
										initial={{ opacity: 0, marginBottom: "-2.5rem" }}
										animate={{ opacity: 1, marginBottom: "0rem" }}
										exit={{ opacity: 0, marginBottom: "-3rem" }}
										layout
										transition={{ duration: 0.2 }}
										key={item.name}
										className=
											"w-full min-h-12 button-like zzz-fg-text flex-col justify-center height-in overflow-hidden rounded-lg flex duration-200 bg-input/50 text-accent hover:bg-input/80"
										
										onClick={(e) => {
											if (e.target === e.currentTarget) {
												setSelected(modRouteFromURL(item.source));
												setRightSlideOverOpen(true);
											}
										}}
										style={{
											height: leftSidebarOpen ? "" : "2.5rem",
											width: leftSidebarOpen ? "" : "2.5rem",
											padding: leftSidebarOpen ? "" : "0px",
											background: item.modStatus === 2 ? "color-mix(in oklab, var(--accent) 20%, transparent)" : "",
										}}
									>
										{leftSidebarOpen ? (
											<div className="fade-in flex items-center w-full gap-1 pl-2 pointer-events-none">
												{[
													<EyeIcon className="min-h-4 max-h-4 min-w-4 " />,
													<UploadIcon className="min-h-4 max-h-4 min-w-4 " />,
												][item.modStatus - 1] || <FolderCheckIcon className="min-h-4 max-h-4 min-w-4" />}
												<Label className="min-w-69 w-69 pointer-events-none">
													{item.name.split(/[/\\]/).slice(-1)[0]}
												</Label>
											</div>
										) : (
											<div className="flex items-center justify-center w-full h-full">{index + 1}</div>
										)}
									</motion.div>
								))}
							</>
						) : (
							<>
								<div className="aspect-square min-h-10 button-like height-in bg-input/50 text-accent hover:bg-input/80 flex flex-col items-center justify-center overflow-hidden text-xs duration-200 rounded-lg">
									<UploadIcon className="min-h-2 min-w-2 w-4 h-4" />{" "}
									{installedItems.filter((item) => item.modStatus === 2).length}
								</div>
								<div className="aspect-square min-h-10 button-like height-in bg-input/50 text-accent hover:bg-input/80 flex flex-col items-center justify-center overflow-hidden text-xs duration-200 rounded-lg">
									<EyeIcon className="min-h-2 min-w-2 w-4 h-4" />
									{installedItems.filter((item) => item.modStatus === 1).length}
								</div>
								<div className="aspect-square min-h-10 button-like height-in bg-input/50 text-accent hover:bg-input/80 flex flex-col items-center justify-center overflow-hidden text-xs duration-200 rounded-lg">
									<FolderCheckIcon className="min-h-2 min-w-2 w-4 h-4" />
									{installedItems.filter((item) => item.modStatus === 0).length}
								</div>{" "}
							</>
						)}
					</AnimatePresence>
				</SidebarContent>
			</SidebarGroup>
		</>
	);
}

export default LeftOnline;

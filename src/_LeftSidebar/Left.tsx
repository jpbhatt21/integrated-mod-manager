import { Sidebar, SidebarContent, SidebarFooter, SidebarGroupLabel } from "@/components/ui/sidebar";
import { ArrowUpRightFromCircleIcon, Globe, HardDriveDownload, PlayIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { GAME, LEFT_SIDEBAR_OPEN, ONLINE, SETTINGS, TEXT_DATA, XXMI_MODE } from "@/utils/vars";
import { AnimatePresence, motion } from "motion/react";
import LeftOnline from "./LeftOnline";
import LeftLocal from "./LeftLocal";
import Settings from "./components/Settings";
import { GAME_NAMES, ONLINE_TRANSITION } from "@/utils/consts";
import { useInstalledItemsManager } from "@/utils/utils";
import Downloads from "./components/Downloads";
import BatchOperations from "./components/Batch";
import { launchGame } from "@/utils/init";
import Restore from "./components/Restore";
import { confirmAndCancelDownloadsForGameSwitch } from "@/utils/downloadManager";
import Remove from "./components/Remove";
function LeftSidebar() {
	const leftSidebarOpen = useAtomValue(LEFT_SIDEBAR_OPEN);
	const textData = useAtomValue(TEXT_DATA);
	const [online, setOnline] = useAtom(ONLINE);
	const customMode = useAtomValue(XXMI_MODE);
	const setGame = useSetAtom(GAME);
	const game = useAtomValue(SETTINGS).global.game;

	useInstalledItemsManager();
	return (
		<Sidebar collapsible="icon" className="pt-8 pointer-events-auto">
			<SidebarContent className="bg-sidebar bgpattern h-full gap-0 overflow-hidden border border-t-0">
				<div className="flex flex-col w-full max-h-full min-h-full">
					<div className="min-h-16 min-w-16 flex shrink-0 items-center justify-center h-16 gap-5 p-0 border-b">
						<div
							id="IMMLogo"
							className="aspect-square logo h-10"
							onClick={async () => {
								if (!(await confirmAndCancelDownloadsForGameSwitch())) return;
								setGame("");
							}}
						></div>
						<div
							className="max-w-28 font-en min-w-29 flex flex-col text-center duration-200 ease-linear"
							style={{
								marginRight: leftSidebarOpen ? "" : "-8.125rem",
								opacity: leftSidebarOpen ? "" : "0",
							}}
						>
							<label className="text-2xl text-[#eaeaea] min-w-fit">{GAME_NAMES[game] || "Integrated"}</label>
							<label className="min-w-fit text-accent textaccent text-sm opacity-75">Mod Manager</label>
						</div>
					</div>

					<div className="duration-200 shrink-0 px-0 w-full mt-2.5">
						<SidebarGroupLabel className="justify-between">
							{textData.Mode}
						</SidebarGroupLabel>
						<div
							className="min-h-fit grid justify-between w-full grid-cols-2 gap-2 px-2 overflow-hidden"
							style={{
								gridTemplateColumns: leftSidebarOpen ? "" : "repeat(1, minmax(0, 1fr))",
							}}
						>
							<Button
								onClick={() => {
									setOnline(false);
								}}
								className={
									"w-full overflow-hidden text-ellipsis " +
									(!online && "hover:brightness-125 bg-accent bgaccent text-background")
								}
							>
								<HardDriveDownload className="w-6 h-6" />
								{leftSidebarOpen && textData.Installed}
							</Button>
							<Button
								onClick={() => {
									setOnline(true);
								}}
								className={
									"w-full overflow-hidden text-ellipsis " +
									(online && "hover:brightness-125 bg-accent bgaccent  text-background")
								}
							>
								<Globe className="w-6 h-6" />
								{leftSidebarOpen && textData.Online}
							</Button>
						</div>
					</div>
					<Separator
						className="w-full ease-linear duration-200 min-h-[0.0625rem] my-2.5 bg-border"
						style={{
							opacity: leftSidebarOpen ? "0" : "",
							height: leftSidebarOpen ? "0px" : "",
							marginBlock: leftSidebarOpen ? "0.25rem" : "",
						}}
					/>
					<div className="flex flex-row flex-1 w-full min-h-0 p-0 overflow-hidden">
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.div
								{...ONLINE_TRANSITION(online)}
								key={online ? "online" : "local"}
								className=" flex flex-col max-w-full max-h-full min-w-full"
							>
								{online ? <LeftOnline /> : <LeftLocal />}
							</motion.div>
						</AnimatePresence>
					</div>

					<Separator className="w-full ease-linear duration-200 min-h-[0.0625rem]  bg-border" />
					<SidebarFooter className="min-h-fit flex flex-col shrink-0 items-center justify-between w-full gap-2 overflow-hidden duration-200">
						<Downloads />
						{leftSidebarOpen ? (
							<>
								<div className="flex shrink-0 items-center justify-between w-full overflow-hidden duration-200">
									<BatchOperations leftSidebarOpen={leftSidebarOpen} />
									<Restore leftSidebarOpen={leftSidebarOpen} />
								</div>
								<div className="flex shrink-0 items-center justify-between w-full overflow-hidden duration-200">
									<Button onClick={() => launchGame()} className="w-38.75 h-12">
										<PlayIcon />
										{textData.Start}
									</Button>
									<Settings leftSidebarOpen={leftSidebarOpen} />
								</div>
							</>
						) : (
							<>
								<div className="hidden-for-1s">
									<Button className="min-h-12 min-w-12 peer">
										<ArrowUpRightFromCircleIcon className="w-6 h-6" />
									</Button>
									<div className="fixed opacity-0 -mb-16 -ml-16 blur-md peer-hover:blur-none hover:blur-none peer-hover:mb-0 peer-hover:ml-0 pointer-events-none peer-hover:opacity-100 peer-hover:pointer-events-auto duration-300  hover:pointer-events-auto hover:opacity-100 hover:ml-0 hover:mb-0  -left-0.5 bottom-0.5 -translate-x-1/2 translate-y-1/2 rounded-full border w-72  aspect-square flex flex-col items-center gap-2 z-10  bg-sidebar/20 backdrop-blur-xs">
										<Button
											onClick={() => launchGame()}
											disabled={!!customMode}
											className="bg-tra absolute flex active:scale-100 items-center justify-end h-40 w-40 bg-transparent border rounded-full ml-0.5 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
										>
											<div className="w-20 h-20 rounded-tr-full mt-4 -mr-3 text-[0.625rem] flex flex-col items-center justify-center  -translate-y-1/2">
												<PlayIcon className="min-w-6 min-h-6 " />
											</div>
										</Button>
										<div className="h-1/2 max-h-1/2 max-w-20 ml-22 flex flex-col justify-between w-20">
											<div className="mt-3 ml-1">
												<BatchOperations leftSidebarOpen={leftSidebarOpen} />
											</div>
											<div className="ml-13.5 -mt-6.5 mb-6.5">
												<Restore leftSidebarOpen={leftSidebarOpen} />
											</div>
											<div className="ml-20.5 -mt-8 mb-1 ">
												<Settings leftSidebarOpen={leftSidebarOpen} />
											</div>
										</div>
									</div>
								</div>
							</>
						)}
						<Remove />
					</SidebarFooter>
				</div>
			</SidebarContent>
		</Sidebar>
	);
}
export default LeftSidebar;

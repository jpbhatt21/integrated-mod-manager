import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	MOD_LIST,
	// LEFT_SIDEBAR_OPEN,
	ONLINE,
	ONLINE_DATA,
	ONLINE_PATH,
	ONLINE_SORT,
	ONLINE_TYPE,
	// RIGHT_SIDEBAR_OPEN,
	// RIGHT_SLIDEOVER_OPEN,
	SEARCH,
	SORT,
	TEXT_DATA,
} from "@/utils/vars";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
	DownloadIcon,
	EyeIcon,
	// PanelLeftCloseIcon,
	// PanelLeftOpenIcon,
	// PanelRightCloseIcon,
	// PanelRightOpenIcon,
	RefreshCwIcon,
	SearchIcon,
	ThumbsUpIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import Notice from "./Notice";
// import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { addToast } from "@/_Toaster/ToastProvider";
import { refreshModList } from "@/utils/filesys";
import { SORT_OPTIONS } from "@/utils/consts";
import { handleInAppLink } from "@/utils/utils";
const searched = {
	online: "",
	offline: "",
};
function TopBar() {
	// const [leftSidebarOpen, setLeftSidebarOpen] = useAtom(LEFT_SIDEBAR_OPEN);
	// const [rightSidebarOpen, setRightSidebarOpen] = useAtom(RIGHT_SIDEBAR_OPEN);
	// const [rightSlideOverOpen, setRightSlideOverOpen] = useAtom(RIGHT_SLIDEOVER_OPEN);
	const [onlineType, setOnlineType] = useAtom(ONLINE_TYPE);
	const [onlineSort, setOnlineSort] = useAtom(ONLINE_SORT);
	const [onlinePath, setOnlinePath] = useAtom(ONLINE_PATH);
	const [sort, setSort] = useAtom(SORT);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [search, setSearch] = useAtom(SEARCH);
	const [term, setTerm] = useState("");
	const textData = useAtomValue(TEXT_DATA);
	const online = useAtomValue(ONLINE);
	const setModList = useSetAtom(MOD_LIST);
	const setOnlineData = useSetAtom(ONLINE_DATA);
	useEffect(() => {
		const handler = setTimeout(
			() => {
				if (online && term?.startsWith("http")) {
					handleInAppLink(term);
					const searchInput = (document.getElementById("search-input") as HTMLInputElement) || null;
					if(searchInput){
						searchInput.value = "";
					searchInput.blur();
					}
					if (online) setOnlinePath("home&_type=" + onlineType);
					else setSearch("");
					return;
				}
				if (online) {
					if (term.trim() === "") {
						setOnlinePath("home&_type=" + onlineType);
					} else {
						setOnlinePath(`search/${term}&_type=${onlineType}`);
					}
				} else setSearch(term);
			},
			online ? 250 : 100
		);
		return () => {
			clearTimeout(handler);
		};
	}, [term]);
	useEffect(() => {
		let searchInput = (document.getElementById("search-input") as HTMLInputElement) || null;
		if (searchInput) {
			searched[online ? "offline" : "online"] = online
				? search
				: onlinePath.startsWith("search/")
					? onlinePath.split("search/")[1].split("&_type=")[0]
					: "";
			searchInput.value = online ? searched.online : searched.offline;
		}
	}, [online]);
	useEffect(() => {
		let searchInput = null as HTMLInputElement | null;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.keyCode == 116) window.location.reload(); // F5
			if (event.keyCode == 121) event.preventDefault();
			if (event.keyCode > 111 && event.keyCode < 124) return; // F1-F12
			if (!searchInput) searchInput = (document.getElementById("search-input") as HTMLInputElement) || null;
			if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
				let activeEl = document.activeElement;
				if (activeEl?.tagName === "BUTTON") activeEl = null;
				if (activeEl === document.body || activeEl === null) searchInput.focus();
				else if (event.code === "Escape" && activeEl === searchInput) {
					searchInput.value = "";
					searchInput.blur();
					if (online) setOnlinePath("home&_type=" + onlineType);
					else setSearch("");
				}
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [online]);
	return (
		<div className="text-accent min-h-16 flex items-center justify-center w-full h-16 gap-2 p-2">
			<div className="bg-sidebar button-like flex items-center justify-between w-full h-full px-3 py-1 overflow-hidden border rounded-lg">
				<SearchIcon className="text-muted-foreground flex-shrink-0 w-4 h-4 mr-2" />
				<Input
					id="search-input"
					defaultValue={online ? "" : search}
					placeholder={textData.Search}
					className="text-foreground zzz-rounded placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 h-8 bg-transparent border-0"
					onChange={(e) => {
						setTerm(e.target.value);
					}}
					onBlur={(e) => {
						setTerm(e.target.value);
					}}
				/>
			</div>
			<div className="data-wuwa:bg-sidebar data-wuwa:min-w-32 min-w-28 data-wuwa:border h-full bg-transparent border-0 rounded-lg">
				{
					<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
						<PopoverTrigger asChild>
							<div className="min-w-fit button-like zzz-border hover:brightness-150 bg-sidebar cursor-pointerx flex items-center justify-center h-full gap-1 p-2 text-xs duration-300 rounded-md select-none">
								{online ? (
									onlinePath.startsWith("home") || onlinePath.startsWith("search") ? (
										onlineType == "Mod" ? (
											textData.ModsOnly
										) : (
											textData.All
										)
									) : onlineSort == "" ? (
										textData.Default
									) : (
										{
											Generic_MostLiked: (
												<>
													{textData.Most} <ThumbsUpIcon className="h-4" />
												</>
											),
											Generic_MostViewed: (
												<>
													{textData.Most} <EyeIcon className="h-4" />
												</>
											),
											Generic_MostDownloaded: (
												<>
													{textData.Most} <DownloadIcon className="h-4" />
												</>
											),
										}[onlineSort]
									)
								) : (
									<>{SORT_OPTIONS[sort].replace("Default",textData.Default).replace("Favourite",textData.Favorite)}</>
								)}
							</div>
						</PopoverTrigger>
						<PopoverContent className="data-wuwa:bg-sidebar game-font z-100 data-wuwa:w-32 w-32 data-wuwa:border absolute p-2 my-2 mr-2 -ml-16 bg-sidebar border bgpattern rounded-lg">
							<div className="data-wuwa:gap-0 flex flex-col gap-2" onClick={() => setPopoverOpen(false)}>
								{online ? (
									onlinePath.startsWith("home") || onlinePath.startsWith("search") ? (
										<>
											<div
												className="hover:brightness-150 button-like data-zzz:bg-button zzz-border bg-sidebar min-h-12 cursor-pointerx flex items-center justify-center w-full gap-1 p-2 text-sm duration-300 border-b rounded-md select-none"
												onClick={() => {
													setOnlineType("");
													setOnlinePath((prev) => `${prev.split("&_type=")[0]}&_type=`);
													// setSettings((prev) => ({ ...prev, onlineType: "" }));
													// saveConfig();
												}}
											>
												{textData.All}
											</div>
											<div
												className="hover:brightness-150 bg-sidebar button-like data-zzz:bg-button zzz-border min-h-12 cursor-pointerx flex items-center justify-center w-full gap-1 p-2 text-sm duration-300 border-t rounded-md select-none"
												onClick={() => {
													setOnlineType("Mod");
													setOnlinePath((prev) => `${prev.split("&_type=")[0]}&_type=Mod`);
													// setSettings((prev) => ({ ...prev, onlineType: "Mod" }));
													// saveConfig();
												}}
											>
												{textData.ModsOnly}
											</div>
										</>
									) : (
										<>
											<div
												className="hover:brightness-150 button-like data-zzz:bg-button zzz-border bg-sidebar min-h-12 cursor-pointerx flex items-center justify-center w-full gap-1 p-2 text-sm duration-300 border-b rounded-md select-none"
												onClick={() => {
													setOnlineSort("");
													setOnlinePath((prev) => `${prev.split("&_sort=")[0]}&_sort=`);
												}}
											>
												{textData.Default}
											</div>
											<div
												className="hover:brightness-150 button-like data-zzz:bg-button zzz-border border-y bg-sidebar min-h-12 cursor-pointerx flex items-center justify-center w-full gap-1 p-2 text-sm duration-300 rounded-md select-none"
												onClick={() => {
													setOnlineSort("Generic_MostLiked");
													setOnlinePath((prev) => `${prev.split("&_sort=")[0]}&_sort=most_liked`);
												}}
											>
												{textData.Most} <ThumbsUpIcon className="h-4" />
											</div>
											<div
												className="hover:brightness-150 button-like data-zzz:bg-button zzz-border border-y bg-sidebar min-h-12 cursor-pointerx flex items-center justify-center w-full gap-1 p-2 text-sm duration-300 rounded-md select-none"
												onClick={() => {
													setOnlineSort("Generic_MostViewed");
													setOnlinePath((prev) => `${prev.split("&_sort=")[0]}&_sort=most_viewed`);
												}}
											>
												{textData.Most} <EyeIcon className="h-4" />
											</div>
											<div
												className="hover:brightness-150 button-like data-zzz:bg-button zzz-border bg-sidebar min-h-12 cursor-pointerx flex items-center justify-center w-full gap-1 p-2 text-sm duration-300 border-t rounded-md select-none"
												onClick={() => {
													setOnlineSort("Generic_MostDownloaded");
													setOnlinePath((prev) => `${prev.split("&_sort=")[0]}&_sort=most_downloaded`);
												}}
											>
												{textData.Most} <DownloadIcon className="h-4" />
											</div>
										</>
									)
								) : (
									Object.entries(SORT_OPTIONS).map(([value, label]) => (
										<div
											key={value}
											className="hover:brightness-150 button-like data-zzz:bg-button zzz-border bg-sidebar min-h-12 cursor-pointerx flex items-center justify-center w-full gap-1 p-2 text-sm duration-300 rounded-md select-none"
											onClick={() => {
												setSort(value);
											}}
										>
											{label.replace("Default",textData.Default).replace("Favourite",textData.Favorite)}
										</div>
									))
								)}
							</div>
						</PopoverContent>
					</Popover>
				}
			</div>
			<Notice />
			<Button
				id="refresh-btn"
				onClick={() => {
					if (online) {
						const curPath = onlinePath;
						setOnlinePath("");
						setOnlineData((prev) => {
							delete prev[curPath];
							if (curPath.startsWith("home")) delete prev.banner;
							return { ...prev };
						});
						setTimeout(() => {
							setOnlinePath(curPath);
						}, 50);
					} else {
						addToast({
							type: "info",
							message: textData.RefreshMods,
						});
						refreshModList().then((data) => {
							setModList(data);
						});
					}
				}}
				className="bg-sidebar flex items-center justify-center w-12 h-12 gap-0 duration-200 border rounded-lg"
			>
				<RefreshCwIcon></RefreshCwIcon>
			</Button>
		</div>
	);
}

export default TopBar;

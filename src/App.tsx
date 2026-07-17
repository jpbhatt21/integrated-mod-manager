import { useAtom, useAtomValue, useSetAtom } from "jotai";
import "./App.css";
import {
	ANIMATIONS,
	BLUR,
	CHANGES,
	DATA,
	ERR,
	GAME,
	INIT_DONE,
	LANG,
	LEFT_SIDEBAR_OPEN,
	MOD_CHECK_PROGRESS,
	MOD_LIST,
	ONLINE,
	PROGRESS_OVERLAY,
	RIGHT_SIDEBAR_OPEN,
	RIGHT_SLIDEOVER_OPEN,
	SCALE,
	SETTINGS,
	OPTIMIZED,
} from "./utils/vars";
import { AnimatePresence, motion, MotionGlobalConfig } from "motion/react";
import Checklist from "./_Checklist/Checklist";
import { initializeThemes } from "./utils/theme";
import Changes from "./_Changes/Changes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { refreshModList, saveConfigs } from "./utils/filesys";
import { SidebarProvider } from "./components/ui/sidebar";
import LeftSidebar from "./_LeftSidebar/Left";
import Main from "./_Main/Main";
import RightLocal from "./_RightSidebar/RightLocal";
import RightOnline from "./_RightSidebar/RightOnline";
import { main } from "./utils/init";
import ToastProvider from "./_Toaster/ToastProvider";
import Progress from "./_Progress/Progress";
import { Mod, ModData } from "./utils/types";
import Optimizing from "./_Optimizing/Optimizing";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogTitle,
} from "./components/ui/alert-dialog";
import { OPTIMIZE_TARGET } from "./utils/consts";
import { scaleHandler } from "./utils/ResizeHandles";
import { initializeUserStats } from "./utils/userStats";
// import { Button } from "./components/ui/button";
const animateProps = {
	initial: { opacity: 0, filter: "blur(6px)" },
	animate: { opacity: 1, filter: "blur(0px)" },
	exit: { opacity: 0, filter: "blur(6px)" },
};
function App() {
	const [switchConfirm, setSwitchConfirm] = useState<{ message: string; resolve: (value: boolean) => void } | null>(
		null
	);
	useEffect(() => {
		const handler = (event: Event) => setSwitchConfirm((event as CustomEvent).detail);
		window.addEventListener("download-switch-confirm", handler);
		return () => window.removeEventListener("download-switch-confirm", handler);
	}, []);
	const initDone = useAtomValue(INIT_DONE);
	const lang = useAtomValue(LANG);
	const err = useAtomValue(ERR);
	const online = useAtomValue(ONLINE);
	const game = useAtomValue(GAME);
	const changes = useAtomValue(CHANGES);
	const settings = useAtomValue(SETTINGS);
	const animations = useAtomValue(ANIMATIONS);
	const leftSidebarOpen = useAtomValue(LEFT_SIDEBAR_OPEN);
	const scale = useAtomValue(SCALE);
	const blur = useAtomValue(BLUR);
	const [rightSidebarOpen, setRightSidebarOpen] = useAtom(RIGHT_SIDEBAR_OPEN);
	const [rightSlideOverOpen, setRightSlideOverOpen] = useAtom(RIGHT_SLIDEOVER_OPEN);
	const setModList = useSetAtom(MOD_LIST);
	const modCheckProgress = useAtomValue(MOD_CHECK_PROGRESS);
	const progressOverlay = useAtomValue(PROGRESS_OVERLAY);
	const [_, setShowModeSwitch] = useState(false);
	const [previousOnline, setPreviousOnline] = useState(online);
	const initializedRef = useRef(false);
	const statsInitializedRef = useRef(false);
	const [optimized, setOptimized] = useAtom(OPTIMIZED);
	const [data, setData] = useAtom(DATA);

	const [isOptimizing, setIsOptimizing] = useState(false);

	const afterInit = useCallback(async () => {
		saveConfigs();
		const modList = await refreshModList(true);
		if (game && (optimized[game] ?? "0") < OPTIMIZE_TARGET) {
			const modObj = modList.reduce(
				(acc, mod) => {
					acc[mod.path] = mod;
					return acc;
				},
				{} as Record<string, Mod>
			);
			const newData = {} as Record<string, ModData>;
			Object.entries(data).forEach(([key, val]) => {
				if (val?.vars?.namespace) {
					const allValidNamespaceVars = {} as Record<string, Set<string>>;
					const modData = modObj[key];
					if (modData?.files) {
						Object.values(modData.files).forEach((vars) => {
							if (vars.length && vars[0].namespace) {
								const namespace = vars[0].namespace;
								vars.map((v) => {
									if (!Object.hasOwn(allValidNamespaceVars, v.target)) {
										allValidNamespaceVars[v.target] = new Set();
									}
									allValidNamespaceVars[v.target].add(namespace);
								});
							}
						});
					}
					const vars = val.vars.namespace;
					delete val.vars.namespace;
					Object.entries(vars).forEach(([target, data]) => {
						if (allValidNamespaceVars[target]?.size == 1) {
							const namespace = Array.from(allValidNamespaceVars[target])[0];
							//@ts-ignore
							val.vars[namespace] = val.vars[namespace] ?? {};
							//@ts-ignore
							val.vars[namespace][target] = val.vars[namespace][target] ?? data;
						}
					});

					console.log("Namespace found for mod:", key, "Namespace:", val.vars.namespace, "ModData:", modData);
				}
				newData[key] = val;
			});
			setData(newData);
			if (modList.length > 0) setIsOptimizing(true);
		}
		setModList(modList);
		return Promise.resolve();
	}, [optimized, setModList, setOptimized, game, data, setData]);
	useEffect(() => {
		if (initializedRef.current) return;
		initializedRef.current = true;
		initializeThemes();
		main();
	}, []);
	useEffect(() => {
		if (!initDone || !game || statsInitializedRef.current) return;
		statsInitializedRef.current = true;
		void initializeUserStats();
	}, [game, initDone]);
	useEffect(() => {
		if (err) {
			throw new Error(err);
		}
	}, [err]);
	useEffect(() => {
		if (scale) {
			scaleHandler(scale);
		}
		if (typeof blur === "number") {
			document.documentElement.style.setProperty("--blur-xs", `${4 * blur}px`);
			document.documentElement.style.setProperty("--blur-sm", `${8 * blur}px`);
			document.documentElement.style.setProperty("--blur-md", `${12 * blur}px`);
			document.documentElement.style.setProperty("--blur-2xl", `${40 * blur}px`);
		}
		if (!animations) {
			const style = document.createElement("style");
			style.id = "disabled-animations-override"; // Added unique ID
			style.textContent = `
    *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        animation-iteration-count: 1 !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
        scroll-behavior: auto !important;
    }
`;
			MotionGlobalConfig.skipAnimations = true;
			document.head.appendChild(style);
		} else {
			const styleElement = document.getElementById("disabled-animations-override");
			if (styleElement) {
				styleElement.remove();
			}
			MotionGlobalConfig.skipAnimations = false;
		}
	}, [scale, blur, animations]);
	useEffect(() => {
		if (previousOnline !== online) {
			setShowModeSwitch(true);
			setPreviousOnline(online);
			const timer2 = setTimeout(() => {
				setRightSidebarOpen(!online);
			}, 300);

			const timer = setTimeout(() => {
				setShowModeSwitch(false);
			}, 1000);

			return () => {
				clearTimeout(timer);
				clearTimeout(timer2);
			};
		}
		return undefined;
	}, [online]);
	const leftSidebarStyle = useMemo(
		() => ({
			minWidth: leftSidebarOpen ? "20.95rem" : "3.95rem",
		}),
		[leftSidebarOpen]
	);
	const rightSidebarStyle = useMemo(
		() => ({
			minWidth: rightSidebarOpen ? "20.95rem" : "0rem",
		}),
		[rightSidebarOpen]
	);
	return (
		<div id="background" className="game-font fixed border-b flex flex-row items-start justify-start w-full h-full">
			<div
				className="bg-bgg fixed w-screen h-screen"
				style={{
					opacity: (settings.global.display.bgOpacity || 1) * 0.1,
					animation: settings.global.display.bgType == 2 ? "moveDiagonal 15s linear infinite" : "",
					backgroundImage: settings.global.display.bgType == 0 ? "none" : "",
					backgroundRepeat: settings.global.display.bgType == 0 ? "no-repeat" : "",
				}}
			></div>
			<SidebarProvider open={leftSidebarOpen}>
				<LeftSidebar />
			</SidebarProvider>
			<SidebarProvider open={rightSidebarOpen}>
				<RightLocal />
			</SidebarProvider>
			<RightOnline open={online && rightSlideOverOpen} />
			<div className="fixed flex flex-row w-full h-full">
				<div className="h-full duration-200 ease-linear" style={leftSidebarStyle} />
				<Main />
				<div className="h-full duration-300 ease-linear" style={rightSidebarStyle} />
			</div>
			<div className="fixed flex flex-row w-full h-full pointer-events-none">
				<div className="h-full duration-200 ease-linear" style={leftSidebarStyle} />
				<AnimatePresence>
					{online && rightSlideOverOpen && (
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							onClick={() => setRightSlideOverOpen(false)}
							className="w-full pointer-events-auto h-full bg-background/40 backdrop-blur-[calc(var(--blur-xs)*0.5)]"
						/>
					)}
				</AnimatePresence>
			</div>

			<div
				className="fixed pointer-events-none duration-300 text-[0.5rem] opacity-50 rounded-tl-md flex pl-2 gap-1.5 flex-row items-center right-0 h-8 w-72 bg-sidebar border z-10"
				style={{ bottom: modCheckProgress.open ? "0px" : "-3rem" }}
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={modCheckProgress.total}
				aria-valuenow={modCheckProgress.checked}
			>
				Mods Checked :
				<div className="w-42 border flex h-4 rounded-sm overflow-hidden">
					<div
						className="bg-accent duration-100 h-full rounded-r-sm"
						style={{
							width: `${modCheckProgress.total ? (modCheckProgress.checked / modCheckProgress.total) * 100 : 0}%`,
						}}
					></div>
				</div>
				<div className="flex font-en min-w-fit text-center flex-col">
					<label>{modCheckProgress.checked}</label>
					<div className="w-full h-[0.0625rem] bg-border rounded-full"></div>
					<label>{modCheckProgress.total}</label>
				</div>
			</div>
			<AnimatePresence>{(!initDone || !lang || !game) && <Checklist />}</AnimatePresence>
			<AnimatePresence>
				{changes.title && <Changes afterInit={afterInit} animateProps={animateProps} />}
			</AnimatePresence>
			<AnimatePresence>{progressOverlay.open && <Progress animateProps={animateProps} />}</AnimatePresence>
			<AnimatePresence>
				{isOptimizing && <Optimizing setIsOptimizing={setIsOptimizing} animateProps={animateProps} />}
			</AnimatePresence>
			<ToastProvider />
			<AlertDialog
				open={!!switchConfirm}
				onOpenChange={(open) => {
					if (!open && switchConfirm) {
						switchConfirm.resolve(false);
						setSwitchConfirm(null);
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogTitle>Cancel Downloads?</AlertDialogTitle>
					<AlertDialogDescription className="whitespace-pre-line">{switchConfirm?.message}</AlertDialogDescription>
					<AlertDialogFooter className="sm:flex-row sm:justify-evenly w-full">
						<AlertDialogCancel variant="warn">Keep Downloading</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								switchConfirm?.resolve(true);
								setSwitchConfirm(null);
							}}
						>
							Cancel Downloads
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
export default App;

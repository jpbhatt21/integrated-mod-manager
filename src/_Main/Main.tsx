import { AnimatePresence, motion } from "motion/react";
import { useAtom, useAtomValue } from "jotai";
import { CONFLICTS_OPEN, ONLINE } from "@/utils/vars";
import MainLocalNavigation from "./MainLocalNavigation";
import MainOnline from "./MainOnline";
import BottomBar from "./components/BottomBar";
import TopBar from "./components/TopBar";
import { ONLINE_TRANSITION } from "@/utils/consts";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import ModConflicts from "@/_Main/components/ModConflicts";

function Main() {
	const online = useAtomValue(ONLINE);
	const [debouncedOnline, setDebouncedOnline] = useState(online);
	const [conflictsOpen, setConflictsOpen] = useAtom(CONFLICTS_OPEN)
	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedOnline(online);
		}, 600);

		return () => {
			clearTimeout(handler);
		};
	}, [online]);
	return (
		<div className="border border-t-0 flex flex-col w-full h-full overflow-hidden duration-200 mt-8 pb-8"
		>
			<TopBar />
			<div className="flex w-full h-full px-2 overflow-hidden">
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.div
						{...ONLINE_TRANSITION(online)}
						key={online == debouncedOnline ? (online ? "online" : "local") : "transitioning"}
						className=" flex flex-col items-center h-full min-w-full overflow-y-hidden delay-200"
					>
						{online == debouncedOnline ? online ? <MainOnline /> : <MainLocalNavigation /> : <></>}
					</motion.div>
				</AnimatePresence>
			</div>
			<Dialog open={conflictsOpen} onOpenChange={setConflictsOpen}>
				<ModConflicts/>
			</Dialog>
			<BottomBar />
		</div>
	);
}

export default Main;

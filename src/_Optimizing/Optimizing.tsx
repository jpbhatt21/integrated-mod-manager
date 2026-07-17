import { addToast } from "@/_Toaster/ToastProvider";
import { OPTIMIZE_TARGET } from "@/utils/consts";
import { saveConfigs, toggleMod, validateModDownload } from "@/utils/filesys";
import { DATA, GAME, MOD_LIST, OPTIMIZED, TEXT_DATA } from "@/utils/vars";
import { useAtomValue, useSetAtom } from "jotai";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

function Optimizing({
	setIsOptimizing,
	animateProps,
}: {
	setIsOptimizing: (value: boolean) => void;
	animateProps?: any;
}) {
	const modList = useAtomValue(MOD_LIST);
	const game = useAtomValue(GAME);
	const textData = useAtomValue(TEXT_DATA);
	const setOptimized = useSetAtom(OPTIMIZED);
	const setData = useSetAtom(DATA);
	const [completed, setCompleted] = useState({
		count: 0,
		cur: "",
	});
	const total = modList.length;
	useEffect(() => {
		//make it such that all keyboard input is ignored while this is open
		const handleKeyDown = (e: KeyboardEvent) => {
			e.preventDefault();
			e.stopPropagation();
		};
		window.addEventListener("keydown", handleKeyDown, true);
		return () => {
			window.removeEventListener("keydown", handleKeyDown, true);
		};
	}, []);
	useEffect(() => {
		let comp = { count: 0, cur: "" };
		setCompleted(comp);
		async function optimize() {
            try{
			for (let i = 0; i < modList.length; i++) {
				const mod = modList[i];
				comp.count = i + 1;
				comp.cur = mod.path;
				setCompleted({ ...comp });
				const count = await validateModDownload(mod.path, true, true);
				if (count) {
					console.log(`[IMM] Optimized ${count} files for mod: ${mod.name}`);
					setData((prev) => {
						if (prev[mod.path]?.vars) {
							const newVars = {} as Record<string, Record<string, any>>;
							Object.entries(prev[mod.path].vars as Record<string, Record<string, any>>).forEach(
								([namespace, targets]) => {
									if (namespace.toLowerCase().endsWith(".ini"))
										namespace = namespace.split(/[/\\]/).slice(count).join("\\");
									newVars[namespace] = targets;
								}
							);
							prev[mod.path].vars = newVars;
							return { ...prev };
						}
						return prev;
					});
                    toggleMod(mod.path, true, true);
				} else console.log(`[IMM] No optimization needed for mod: ${mod.name}`);
			}
			saveConfigs();
			setOptimized((prev) => ({ ...prev, [game]: OPTIMIZE_TARGET }));
			setIsOptimizing(false);
        }
        catch(e){
            console.error("[IMM] Error during optimization:", e);
            addToast({
                type: "error",
                message: "Error during optimization. Please check the console for details.",
            });
            setIsOptimizing(false);
        }
		}
		if (total > 0 && game) {
			optimize();
		}
	}, [total, game]);
	return (
		<motion.div
			key="optimizing"
			{...animateProps}
			className="fixed top-0 z-999 right-0 w-full h-full backdrop-blur-md bg-background/50 flex flex-col items-center justify-center"
		>
			<div className="w-180 h-66 flex flex-col items-center mt-8 gap-4 p-4 overflow-hidden">
				<div className="text-accent min-h-fit my-6 text-3xl">{textData.optDir}</div>
				<div className="w-120 bg-background/50 button-like h-8 overflow-hidden border rounded-lg">
					<div
						className="bg-muted data-zzz:bg-accent bgaccent zzz-rounded h-full duration-100 rounded-lg opacity-75"
						style={{
							width: `${total ? (completed.count / total) * 100 : 0}%`,
						}}
					></div>
				</div>
				<div className="flex flex-row gap-2 w-full justify-between">
					<div className="text-sm text-accent">{completed.cur}</div>
					<div className="text-sm text-accent">
						{completed.count}/{total}
					</div>
				</div>
				<div className="fixed bottom-2 text-destructive">{textData.dntClose}</div>
			</div>
		</motion.div>
	);
}

export default Optimizing;

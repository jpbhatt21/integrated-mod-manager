import { addToast } from "@/_Toaster/ToastProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GAMES, managedSRC, managedTGT } from "@/utils/consts";
import { applyPreset, folderSelector, verifyDirStruct } from "@/utils/filesys";
import { getDataDir, readXXMIConfig, verifyGameDir } from "@/utils/init";
import { join } from "@/utils/utils";
import { CHANGES, GAME, SOURCE, TARGET, TEXT_DATA, XXMI_DIR, XXMI_MODE } from "@/utils/vars";
import { exists } from "@/utils/fs";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { CheckIcon, FolderCog2Icon, HelpCircleIcon, InfoIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { info } from "@/lib/logger";

function Page4({ setPage }: { setPage: (page: number) => void }) {
	const [tgt, setTgt] = useState(getDataDir());
	const [src, setSrc] = useState(tgt);
	const [checked, setChecked] = useAtom(XXMI_MODE);
	const [checked2, setChecked2] = useState(true);
	const setSource = useSetAtom(SOURCE);
	const [xxmiDir, setXxmiDir] = useAtom(XXMI_DIR);
	const setTarget = useSetAtom(TARGET);
	const textData = useAtomValue(TEXT_DATA);
	const game = useAtomValue(GAME);
	const setChanges = useSetAtom(CHANGES);
	return (
		<div className="text-muted-foreground fixed flex flex-col items-center justify-center w-screen h-screen">
			<div className="fixed z-20 flex flex-col items-center justify-center w-full duration-200">
				{
					<div className="text-accent flex flex-col items-center gap-5 my-2 text-2xl">
						{textData.Select} {checked ? textData.CustomDir : textData.XXMILDir}
						<div
							className="flex items-center gap-2"
							style={{
								opacity: checked ? 0 : 1,
								height: checked ? "0px" : "2.5rem",
								transition: "all 0.3s ease-in-out",
								pointerEvents: checked ? "none" : "auto",
								marginTop: checked ? "-0.625rem" : 0,
								marginBottom: checked ? "-0.625rem" : 0,
							}}
						>
							<Dialog>
								<DialogTrigger>
									<Tooltip>
										<TooltipTrigger>
											<HelpCircleIcon className="hover:opacity-100 inline w-5 h-5 opacity-50" />
										</TooltipTrigger>
										<TooltipContent>
											<p className="text-center w-20">{textData.ClickHelp}</p>
										</TooltipContent>
									</Tooltip>
								</DialogTrigger>
								<DialogContent className="min-h-130">
									<div className="min-h-fit text-accent my-6 text-3xl">
										{textData.SelectingXXMIDir}
										<Tooltip>
											<TooltipTrigger></TooltipTrigger>
											<TooltipContent className="opacity-0"></TooltipContent>
										</Tooltip>
									</div>
									<div className="flex gap-4">
										<div className="w-1/2 items-center text-xs flex flex-col">
											<div className="flex  text-success items-center text-xl justify-center my-4 gap-2">
												<CheckIcon className="inline w-6 h-6" />
												{textData.Correct}
											</div>
											<img src="/EX_COR_XX.png" className="border-2 mb-1 border-success rounded-md" />
											<label>{textData.SelectXXMIFolder}</label>
											<img src="/EX_COR_CONFIG.png" className="border-2 mt-4 mb-1 border-success rounded-md" />
											<label>{textData.ContainConfig}</label>
										</div>
										<div className="w-1/2 items-center text-xs flex flex-col">
											<div className="flex  text-destructive items-center text-xl justify-center my-4 gap-2">
												<XIcon className="inline w-6 h-6" />
												{textData.Incorrect}
											</div>
											<img src="/EX_INC_GI.png" className="border-2 mb-2 border-destructive rounded-md" />
											<img src="/EX_INC_WW.png" className="border-2 mt-4 mb-2 border-destructive rounded-md" />
											<img src="/EX_INC_ZZ.png" className="border-2 mt-4 mb-1 border-destructive rounded-md" />
											<label>{textData.DoNotSelectFolders}</label>
										</div>
									</div>
								</DialogContent>
							</Dialog>
							<Button
								className="aspect-square items-center justify-center"
								onClick={async () => {
									let path = ((await folderSelector(tgt)) as string) || "";
									path =
										(path.endsWith("MI") && GAMES.map((game) => game + "MI").includes(path.split(/[/\\]/).pop() ?? "")) ||
										path.endsWith("XXMI Launcher Config.json")
											? path.split(/[/\\]/).slice(0, -1).join("/")
											: path;

									setXxmiDir(path);
								}}
							>
								<FolderCog2Icon className="inline w-4 h-4" />
							</Button>
							<Input
								type="text"
								onFocus={(e) => {
									e.currentTarget.blur();
									(e.currentTarget.previousElementSibling as HTMLElement)?.click();
								}}
								className="w-108 border-border/0 bg-input/50 text-accent/75 text-ellipsis h-10 overflow-hidden text-center cursor-default"
								value={xxmiDir ?? "-"}
							/>
						</div>
						<div className=" min-w-fit flex items-center gap-2">
							<Checkbox
								checked={!checked}
								onClick={() => setChecked(checked ? 0 : 1)}
								className=" checked:bg-accent bgaccent"
							/>
							<label className="text-accent/75 min-w-fit text-sm">{textData.UsingXXMILauncher}</label>
						</div>
						<div
							className="flex items-center gap-2 overflow-y-hidden"
							style={{
								opacity: !checked ? 0 : 1,
								height: !checked ? "0px" : "2.5rem",
								transition: "all 0.3s ease-in-out",
								pointerEvents: !checked ? "none" : "auto",
								marginTop: !checked ? "-0.625rem" : 0,
								marginBottom: !checked ? "-0.625rem" : 0,
							}}
						>
							<Label className="flex items-center gap-1">
								<Tooltip>
									<TooltipTrigger>
										<InfoIcon className="hover:opacity-100 inline w-4 h-4 opacity-50" />
									</TooltipTrigger>
									<TooltipContent>
										<p className="w-48 text-center">{textData.ThisDirTarget}</p>
									</TooltipContent>
								</Tooltip>
								{textData.TargetDir}
							</Label>
							<Input
								type="text"
								className="w-96 border-border/0 bg-input/50 text-accent/75 text-ellipsis h-10 overflow-hidden text-center cursor-default"
								value={tgt ?? "-"}
							/>
							<Button
								className="w-32"
								onClick={async () => {
									let path = ((await folderSelector(tgt)) as string) || tgt || "";
									path = path.endsWith(managedSRC)
										? path.split(managedSRC)[0]
										: path.endsWith(managedTGT)
											? path.split(managedTGT)[0]
											: path;
									path = !path.endsWith("Mods")
										? (await exists(join(path, "Mods")))
											? join(path, "Mods")
											: path
										: path;
									setTgt(path);
									if (checked2) {
										setSrc(path);
									}
								}}
							>
								{textData.Browse}
							</Button>
						</div>
						<div
							className="flex items-center gap-2 overflow-y-hidden"
							style={{
								opacity: !checked || checked2 ? 0 : 1,
								height: !checked || checked2 ? "0px" : "2.5rem",
								transition: "all 0.3s ease-in-out",
								pointerEvents: !checked || checked2 ? "none" : "auto",
								marginTop: !checked || checked2 ? "-0.625rem" : 0,
								marginBottom: !checked || checked2 ? "-0.625rem" : 0,
							}}
						>
							<Label className="flex items-center gap-1">
								<Tooltip>
									<TooltipTrigger>
										<InfoIcon className="hover:opacity-100 inline w-4 h-4 opacity-50" />
									</TooltipTrigger>
									<TooltipContent>
										<p className="w-48 text-center">{textData.ThisDirSource}</p>
									</TooltipContent>
								</Tooltip>
								{textData.SourceDir}
							</Label>
							<Input
								type="text"
								className="w-96 border-border/0 bg-input/50 text-accent/75 text-ellipsis h-10 overflow-hidden text-center cursor-default"
								value={src ?? "-"}
							/>
							<Button
								className="w-32"
								onClick={async () => {
									if (checked2) return;
									let path = ((await folderSelector(src)) as string) || src || "";
									path = path.endsWith(managedSRC)
										? path.split(managedSRC)[0]
										: path.endsWith(managedTGT)
											? path.split(managedTGT)[0]
											: path;
									path = !path.endsWith("Mods")
										? (await exists(join(path, "Mods")))
											? join(path, "Mods")
											: path
										: path;
									setSrc(path);
								}}
							>
								{textData.Browse}
							</Button>
						</div>
						<div
							className=" min-w-fit flex items-center gap-2"
							style={{
								opacity: !checked ? 0 : 1,
								height: !checked ? "0px" : "2.5rem",
								transition: "all 0.3s ease-in-out",
								pointerEvents: !checked ? "none" : "auto",
								marginTop: !checked ? "-0.625rem" : 0,
								marginBottom: !checked ? "-0.625rem" : 0,
							}}
						>
							<Checkbox
								checked={checked2}
								onClick={() => setChecked2(!checked2)}
								className=" checked:bg-accent bgaccent"
							/>
							<label className="text-accent/75 min-w-fit text-sm">{textData.SameDir}</label>
						</div>
						<Button
							className={"w-32 mt-2"}
							onClick={async () => {
								if (checked) {
									if (!(await exists(tgt)) || (!checked2 && !(await exists(src)))) {
										addToast({
											message: textData.SrcOrTgt,
											type: "error",
										});
										return;
									}
									setTarget(tgt);
									setSource(checked2 ? tgt : src);
								} else {
									await readXXMIConfig(xxmiDir);
									const dirs = await verifyGameDir(game);
									info("verfiying game directories", { dirs });
									if (!dirs.sourceDir || !dirs.targetDir) {
										addToast({
											message: textData.XXMIConfErr,
											type: "error",
										});
										return;
									}
									setSource(dirs.sourceDir);
									setTarget(dirs.targetDir);
								}
								applyPreset([]);
								setChanges(await verifyDirStruct());
								setPage(4);
							}}
						>
							{textData.Confirm}
						</Button>
					</div>
				}
			</div>
		</div>
	);
}
export default Page4;

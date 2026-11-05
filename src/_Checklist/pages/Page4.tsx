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
	const extDriveText = textData.Others._ExtDrive;
	const withGame = (text: string) => text.replace("<game/>", game);
	return (
		<div className="text-muted-foreground fixed flex flex-col items-center justify-center w-screen h-screen">
			<div className="fixed z-20 flex flex-col items-center justify-center w-full duration-200">
				{
					<div className="text-accent flex flex-col items-center gap-5 my-2 text-2xl">
						{textData._Checklist._Help.Select} {textData._Checklist[checked ? "CustomDir" : "XXMILDir"]}
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
											<p className="text-center w-20">{textData._Checklist.ClickHelp}</p>
										</TooltipContent>
									</Tooltip>
								</DialogTrigger>
								<DialogContent className="min-h-130">
									<div className="min-h-fit text-accent my-6 text-3xl">
										{textData._Checklist.SelectingXXMIDir}
										<Tooltip>
											<TooltipTrigger></TooltipTrigger>
											<TooltipContent className="opacity-0"></TooltipContent>
										</Tooltip>
									</div>
									<div className="flex gap-4">
										<div className="w-1/2 items-center text-xs flex flex-col">
											<div className="flex  text-success items-center text-xl justify-center my-4 gap-2">
												<CheckIcon className="inline w-6 h-6" />
												{textData._Checklist.Correct}
											</div>
											<img src="/EX_COR_XX.png" className="border-2 mb-1 border-success rounded-md" />
											<label>{textData._Checklist.SelectXXMIFolder}</label>
											<img src="/EX_COR_CONFIG.png" className="border-2 mt-4 mb-1 border-success rounded-md" />
											<label>{textData._Checklist.ContainConfig}</label>
										</div>
										<div className="w-1/2 items-center text-xs flex flex-col">
											<div className="flex  text-destructive items-center text-xl justify-center my-4 gap-2">
												<XIcon className="inline w-6 h-6" />
												{textData._Checklist.Incorrect}
											</div>
											<img src="/EX_INC_GI.png" className="border-2 mb-2 border-destructive rounded-md" />
											<img src="/EX_INC_WW.png" className="border-2 mt-4 mb-2 border-destructive rounded-md" />
											<img src="/EX_INC_ZZ.png" className="border-2 mt-4 mb-1 border-destructive rounded-md" />
											<label>{textData._Checklist.DoNotSelectFolders}</label>
										</div>
									</div>
								</DialogContent>
							</Dialog>
							<Button
								className="aspect-square items-center justify-center"
								onClick={async () => {
									let path = ((await folderSelector(tgt)) as string) || "";
									path =
										(path.endsWith("MI") &&
											GAMES.map((game) => game + "MI").includes(path.split(/[/\\]/).pop() ?? "")) ||
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
							<label className="text-accent/75 min-w-fit text-sm">{textData._Checklist.UsingXXMILauncher}</label>
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
										<p className="w-48 text-center">{textData._Checklist.ThisDirTarget}</p>
									</TooltipContent>
								</Tooltip>
								{textData._Checklist.TargetDir}
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
										<p className="w-48 text-center">{textData._Checklist.ThisDirSource}</p>
									</TooltipContent>
								</Tooltip>
								{textData._Checklist.SourceDir}
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
							<label className="text-accent/75 min-w-fit text-sm">{textData._Checklist.SameDir}</label>
						</div>
						<Button
							className={"w-32 mt-2"}
							onClick={async () => {
								if (checked) {
									if (!(await exists(tgt)) || (!checked2 && !(await exists(src)))) {
										addToast({
											message: textData._Toasts.SrcOrTgt,
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
											message: textData._Toasts.XXMIConfErr,
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
			<div className="fixed bottom-2">
				{extDriveText.Prompt}
				<Dialog>
					<DialogTrigger className="ml-1 text-destructive">{extDriveText.Here}</DialogTrigger>
					<DialogContent>
						<div className="min-h-fit text-accent my-6 text-3xl">{extDriveText.Title}</div>
						<p className="text-foreground/80 text-sm">{extDriveText.Intro}</p>
						<ul className="text-xs w-full pl-4 text-foreground/80 space-y-2">
							<li>
								<span>1 - </span>
								{extDriveText.Step1Start}
								<span className="text-warn">{withGame(extDriveText.GameModsContent)}</span>
								{extDriveText.Step1Middle}
								<span className="text-warn">{extDriveText.SeparateLocation}</span>
								{extDriveText.Step1End}
								<span className="text-warn">{extDriveText.ExternalDrive}</span>
							</li>
							<li>
								<span>2 - </span>
								{extDriveText.Step2Start}
								<span className="text-warn">{withGame(extDriveText.GameLocation)}</span>
								{extDriveText.Step2Middle}
								<span className="text-warn">{extDriveText.XXMISettings}</span>
								{extDriveText.Step2End}
								<span className="text-warn">{extDriveText.InternalDrive}</span>
							</li>
						</ul>
						<img src="/ExtDriveHelp.png" className="border-2 mb-1 w-4/5 rounded-md" />
						<ul className="text-xs w-full pl-4 text-foreground/80 space-y-2">
							<li>
								<span>3 - </span>
								<span className="text-destructive">{extDriveText.Uncheck}</span>
								{extDriveText.Step3Start}
								<span className="text-warn">{extDriveText.UsingXXMILauncher}</span>
								{extDriveText.Step3Middle}
								<span className="text-warn">{extDriveText.SameDirectory}</span>
								{extDriveText.Step3End}
							</li>
							<li>
								<span>4 - </span>
								<span className="text-success">{extDriveText.TargetDir}</span>
								{extDriveText.Step4Start}
								<span className="text-warn">{withGame(extDriveText.GameModsDirectory)}</span>
								{extDriveText.Step4End}
								<span className="text-warn">{extDriveText.InternalDrive}</span>
							</li>
							<li>
								<span>5 - </span>
								<span className="text-success">{extDriveText.SourceDir}</span>
								{extDriveText.Step5Start}
								<span className="text-warn">{extDriveText.ModsFolder}</span>
								{extDriveText.Step5End}
								<span className="text-warn">{extDriveText.ExternalDrive}</span>
							</li>
						</ul>
						<div className="text-xs text-success w-3/4 text-center">{extDriveText.Reassurance}</div>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
export default Page4;

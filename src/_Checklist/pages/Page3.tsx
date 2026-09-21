import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { confirmAndCancelDownloadsForGameSwitch } from "@/utils/downloadManager";
import { verifyDirStruct } from "@/utils/filesys";
import { CHANGES, GAME, SOURCE, TARGET, TEXT_DATA, XXMI_DIR, XXMI_MODE } from "@/utils/vars";
import { invoke } from "@tauri-apps/api/core";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ArrowUpRightFromSquareIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

let skipP = false;
export function skipPage() {
	skipP = true;
}

function Page3({ setPage }: { setPage: (page: number) => void }) {
	const tgt = useAtomValue(TARGET);
	const src = useAtomValue(SOURCE);
	const [game, setGame] = useAtom(GAME);
	const xxmiDir = useAtomValue(XXMI_DIR);
	const customMode = useAtomValue(XXMI_MODE);
	const [user, setUser] = useState("User");
	const textData = useAtomValue(TEXT_DATA);
	const setChanges = useSetAtom(CHANGES);
	useEffect(() => {
		async function skip() {
			setPage(4);
			setChanges(await verifyDirStruct());
		}
		if (src && tgt) {
			skip();
		} else if (skipP) {
			skipP = false;
			setPage(3);
		} else {
			invoke("get_username").then((name) => {
				if (name) setUser(name as string);
			});
		}
	}, [src, tgt]);
	return (
		<div className="text-muted-foreground fixed flex flex-col items-center justify-center w-screen h-screen">
			<div className="fixed z-20 flex flex-col items-center justify-center w-full h-full duration-200">
				{xxmiDir && !customMode ? (
					<>
						<div className="text-accent my-4 text-2xl">{textData._Checklist.XXMIConfErr}</div>
						<p className="text-foreground w-108 text-lg text-center opacity-75">
							{textData._Checklist.XXMIConfErrMsg.replace("<game/>", game)}
						</p>
						<div className="w-lg flex items-center justify-between">
							<Button
								className={"w-32 scale-110 my-6"}
								onClick={async () => {
									if (!(await confirmAndCancelDownloadsForGameSwitch())) return;
									setGame("");
									setPage(1);
								}}
							>
								{textData._Checklist.SwitchGame}
							</Button>
							<Button
								className={"w-32 scale-110 my-6"}
								onClick={async () => {
									setPage(3);
								}}
							>
								{textData._Checklist.Configr}
							</Button>
						</div>
					</>
				) : (
					<>
						<div className="text-accent text-5xl">
							{textData._Checklist.Greeting} <label id="user">{user}</label>
						</div>
						<div className="text-foreground mt-4 text-2xl opacity-75">{textData._Checklist.IMMXXMI}</div>
						<div className="text-foreground text-lg opacity-75">{textData._Checklist.InstallXXMI}</div>
						<Button
							className={"w-32 scale-110 my-6"}
							style={{ minWidth: "fit-content" }}
							onClick={async () => {
								setPage(3);
							}}
						>
							{textData._Checklist.Continu}
						</Button>

						<AlertDialog>
							<AlertDialogTrigger>
								<a
									className=" hover:opacity-100 flex items-center duration-200 opacity-50"
									href="https://github.com/SpectrumQT/XXMI-Launcher"
									target="_blank"
								>
									<ArrowUpRightFromSquareIcon className="inline w-4 h-4 mb-1" /> {textData._Checklist.WhatIsXXMI}
								</a>
							</AlertDialogTrigger>
							<AlertDialogContent srTitle={textData._Checklist.XXMILauncher}>
								<AlertDialogCancel
									className="top-3 text-destructive right-3 hover:opacity-100 absolute opacity-75"
									variant="hidden"
								>
									<XIcon />
								</AlertDialogCancel>
								<div className="text-foreground/75 flex flex-col items-center gap-4 p-4">
									<h2 className="text-accent text-2xl font-bold">{textData._Checklist.XXMILauncher}</h2>

									<p className=" text-center">
										{textData._Checklist.InstallOpen}{" "}
										<a
											className=" hover:opacity-100 duration-200 opacity-75"
											href="https://github.com/SpectrumQT/XXMI-Launcher"
											target="_blank"
											rel="noreferrer noopener"
										>
											{textData._Checklist.XXMILauncher} <ArrowUpRightFromSquareIcon className="inline w-4 h-4 mb-1" />
										</a>{" "}
										{textData._Checklist.RspMod}
									</p>
									<label>{textData._Checklist.OnceComplete}</label>
									<Button
										className="w-32 mt-2"
										onClick={async () => {
											window.location.reload();
										}}
									>
										{textData._Checklist.Reload}
									</Button>
								</div>
							</AlertDialogContent>
						</AlertDialog>
					</>
				)}
			</div>
			{game == "WW" && (
				<div className="opacity-70 bottom-5 fixed z-30 flex flex-col items-center text-sm">
					<label>{textData._Checklist.AutoMigration}</label>
					<label>{textData._Checklist.MigrationFailed}</label>
					<label>{textData._Checklist.AfterVerify}</label>
				</div>
			)}
		</div>
	);
}
export default Page3;

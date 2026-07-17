import { addToast } from "@/_Toaster/ToastProvider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { UNCATEGORIZED } from "@/utils/consts";
import { applyChanges, createManagedDir, createRestorePoint } from "@/utils/filesys";
import { ChangeInfo } from "@/utils/types";
import { CHANGES, FIRST_LOAD, HELP_OPEN, INIT_DONE, SOURCE, TEXT_DATA } from "@/utils/vars";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ChevronRightIcon, FileIcon, Folder, FolderCog2Icon, FolderCogIcon, HelpCircleIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

let checked = false;
function getChecked() {
	return checked;
}
let onConfirm = () => {};
function Changes({ afterInit, animateProps }: { afterInit: () => Promise<void>; animateProps?: any }) {
	const textData = useAtomValue(TEXT_DATA);
	const [changes, setChanges] = useAtom(CHANGES);
	const [source, _] = useAtom(SOURCE);
	const setInitDone = useSetAtom(INIT_DONE);
	const firstLoad = useAtomValue(FIRST_LOAD);
	const setHelpOpen = useSetAtom(HELP_OPEN);
	const [alertOpen, setAlertOpen] = useState(false);
	const [alertType, setAlertType] = useState<"info" | "warn">("warn");
	const [loading, setLoading] = useState(false);
	useEffect(() => {
		if (!changes.skip) return;
		afterInit().then(() => {
			setTimeout(() => {
				setInitDone(true);
				if (firstLoad && !getChecked()) setHelpOpen(true);
				setChanges({
					...changes,
					skip: false,
					before: [],
					after: [],
					map: {},
					title: "",
				} as ChangeInfo);
			}, 1000);
		});
	}, [changes.skip]);
	return changes.before.length ? (
		<motion.div
			key="changes"
			{...animateProps}
			className="bg-background/50 fixed z-50 flex items-center justify-center w-full h-full duration-200"
			style={{
				backdropFilter: "blur(var(--blur-xs))",
				opacity: 1,
			}}
		>
			<AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
				{alertType == "warn" ? (
					<AlertDialogContent className="max-w-100">
						<div className="text-accent min-h-fit my-4 text-3xl">{textData.Note}</div>
						<div className="text-center text-destructive">{textData.WillBeOrg}</div>
						<div className="flex w-full justify-between">
							<AlertDialogAction>{textData.Back}</AlertDialogAction>
							<AlertDialogCancel
								onClick={() => {
									onConfirm();
								}}
							>
								{textData.IUnd}
							</AlertDialogCancel>
						</div>
					</AlertDialogContent>
				) : (
					<AlertDialogContent className="min-h-fit min-w-fit mt-4">
						<img src="/tutorials/RemoveIMM/1.png" className="max-h-125 rounded-md" />
						<label className="text-accent text-sm text-center max-w-132 ">{textData.RemIMM}</label>
						<AlertDialogAction className="-my-2">{textData.Back}</AlertDialogAction>
					</AlertDialogContent>
				)}
			</AlertDialog>
			<div className="w-180 h-166 bg-background/50 border-border flex flex-col items-center mt-8 gap-4 p-4 overflow-hidden border-2 rounded-lg">
				<div className="text-accent min-h-fit my-6 text-3xl">{textData.ConfirmChanges}</div>
				<div className="flex flex-row items-center w-full gap-2 px-2">
					<Button
						className="aspect-square flex items-center justify-center w-10 h-10"
						onClick={() => {
							const prevPage = document.getElementById("prevPage") as HTMLButtonElement;
							if (prevPage) {
								prevPage.click();
								setChanges({
									...changes,
									skip: false,
									before: [],
									after: [],
									map: {},
									title: "",
								} as ChangeInfo);
							}
						}}
					>
						<FolderCog2Icon className="aspect-square w-5" />
					</Button>
					<div className=" w-157 max-w-157 bg-input/50 min-h-10 flex items-center px-2 text-gray-200 rounded-md">
						<Label className=" max-w-full duration-200">{source}</Label>
					</div>
				</div>
				<div className=" flex items-center -my-2 gap-2">
					<Checkbox id="checkbox" className=" checked:bg-accent bgaccent" />
					<label className="text-accent text-sm opacity-75">{textData.CreateRestore}</label>
				</div>
				<div className="h-100 flex items-center w-full p-0">
					<div className="flex flex-col w-1/2 h-full overflow-x-hidden overflow-y-auto text-gray-300 border rounded-sm">
						{changes.before.map((item, index) => (
							<div
								key={index + item.name}
								className={"w-full min-h-10 border-b flex gap-2 items-center px-2"}
								style={{ backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150" }}
							>
								{item.isDirectory ? <Folder className="w-4 h-4" /> : <FileIcon className="w-4 h-4" />}
								<Label className={"w-full pointer-events-none " + ((index % 2) + 1)}>{item.name}</Label>
							</div>
						))}
					</div>
					<ChevronRightIcon className="text-accent w-8 h-8" />
					<div className="flex flex-col w-1/2 h-full overflow-x-hidden overflow-y-auto text-gray-300 border rounded-sm">
						{changes.after.map((item, index) => (
							<div
								key={index + item.name}
								className={"w-full flex  flex-col"}
								style={{
									backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150",
									borderBottom: index == changes.after.length - 1 ? "" : "0.0625rem solid var(--border)",
								}}
							>
								<div className={"w-full border-b  min-h-10 gap-2 flex items-center px-2"}>
									{item.isDirectory ? <Folder className="w-4 h-4" /> : <FileIcon className="w-4 h-4" />}
									<Label className={"w-full pointer-events-none " + ((index % 2) + 1)}>{item.name}</Label>
								</div>
								<div className="flex flex-col items-center w-full ml-4 border-l">
									{item.children?.map((child, index) => (
										<>
											<div
												key={index + child.name}
												className={"w-full min-h-10 bor der-y flex gap-2 items-center px-2 "}
												style={{
													backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150",
													borderBottom: child.children?.length == 0 ? "" : "0.0625rem solid var(--border)",
													borderTop: index == 0 ? "" : "0.0625rem solid var(--border)",
												}}
											>
												{child.icon ? (
													<img
														src={child.icon}
														className="w-6 h-6 -ml-1 -mr-1 overflow-hidden rounded-full"
														alt="icon"
													/>
												) : child.name == UNCATEGORIZED ? (
													<FolderCogIcon className="aspect-square w-5 h-5 -mr-1 pointer-events-none" />
												) : child.isDirectory ? (
													<Folder className="w-4 h-4" />
												) : (
													<FileIcon className="w-4 h-4" />
												)}
												<Label className={"w-full pointer-events-none " + ((index % 2) + 1)}>{child.name}</Label>
											</div>
											<div className="flex flex-col items-center w-full pl-4">
												{child.children?.map(
													(grandchild, index) =>
														!grandchild.name.endsWith(".imm-collision-checklist") && (
															<div
																key={index + grandchild.name}
																className={"w-full min-h-10 border-l flex gap-2 items-center px-2 "}
																style={{
																	backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150",
																	borderBottom:
																		index == (child.children?.length || 0) - 1 ? "" : "0.0625rem dashed var(--border)",
																}}
															>
																{grandchild.icon ? (
																	<img
																		src={grandchild.icon}
																		className="w-6 h-6 -ml-1 -mr-1 overflow-hidden rounded-full"
																		alt="icon"
																	/>
																) : grandchild.name == UNCATEGORIZED ? (
																	<FolderCogIcon className="aspect-square w-5 h-5 -mr-1 pointer-events-none" />
																) : grandchild.isDirectory ? (
																	<Folder className="w-4 h-4" />
																) : (
																	<FileIcon className="w-4 h-4" />
																)}
																<Label className={"w-full pointer-events-none " + ((index % 2) + 1)}>
																	{grandchild.name.replace("DISABLED_", "").replace("DISABLED", "")}
																</Label>
															</div>
														)
												)}
											</div>
										</>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
				<div className="flex justify-between w-full h-10">
					<Button
						variant="destructive"
						className="w-28"
						onClick={async () => {
							// invoke("exit_app");
							await createManagedDir();
							setChanges((prev) => ({ ...prev, skip: true }));
						}}
					>
						{textData.Skip}
					</Button>
					<div
						className="flex text-xs items-center text-accent/75 hover:text-accent justify-center duration-200"
						onClick={() => {
							setAlertType("info");
							setAlertOpen(true);
						}}
					>
						<HelpCircleIcon className="h-4 -mt-0.5" />
						<label className="text-sm">{textData.WhatIfRem}</label>

						{/* <Tooltip>
							<TooltipTrigger className="flex items-center justify-center text-accent/75 duration-200">
								
								
							</TooltipTrigger>
							<TooltipContent className="p-1 max-w-8 group flex flex-col  rounded-md text-sm">
								<label className="bg-accent rounded px-2">{textData.RemIMM}</label>
							</TooltipContent>
						</Tooltip> */}
					</div>
					<Button
						className="w-28 "
						disabled={loading}
						onClick={async () => {
							checked = document.getElementById("checkbox")?.getAttribute("aria-checked") == "true";
							//info("Is first load:", firstLoad);
							if (firstLoad) setHelpOpen(true);

							onConfirm = async () => {
								setLoading(true);
								try {
									let cont = true;
									if (checked) cont = await createRestorePoint("ORG-");
									if (cont) {
										addToast({ type: "info", message: textData.ApplyingChanges });
										await applyChanges();
										setChanges((prev) => ({ ...prev, skip: true }));
									}
								} catch (e) {
									console.error(e);
								}
								setLoading(false);
							};
							setAlertType("warn");
							setAlertOpen(true);
						}}
					>
						{loading ? textData.processing : textData.Confirm}
					</Button>
				</div>
			</div>
		</motion.div>
	) : (
		<></>
	);
}
export default Changes;

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UNCATEGORIZED } from "@/utils/consts";
import {
	createRestorePoint,
	deleteRestorePoint,
	getRestorePoints,
	previewRestorePoint,
	restoreFromPoint,
} from "@/utils/filesys";
import { Mod } from "@/utils/types";
import { GAME, TEXT_DATA } from "@/utils/vars";
import { useAtomValue } from "jotai";
import { FileIcon, FolderCogIcon, FolderIcon, PlusIcon, SaveAllIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
function Restore({ leftSidebarOpen, disabled = false }: { leftSidebarOpen: boolean; disabled?: boolean }) {
	const textData = useAtomValue(TEXT_DATA);
	const [dialogOpen, setDialogOpen] = useState(false);
	const [restorePoints, setRestorePoints] = useState<string[]>([]);
	const [selectedRestorePoint, setSelectedRestorePoint] = useState<number>(-1);
	const [alertOpen, setAlertOpen] = useState(false);
	const [data, setData] = useState<Mod[]>([]);
	const game = useAtomValue(GAME);
	useEffect(() => {
		const abortController = new AbortController();
		if (dialogOpen) {
			getRestorePoints().then((r) => {
				if (!abortController.signal.aborted) {
					setRestorePoints(r);
				}
			});
		} else {
			setSelectedRestorePoint(-1);
			setData([]);
		}
		return () => {
			abortController.abort();
		};
	}, [dialogOpen]);
	useEffect(() => {
		if (restorePoints[selectedRestorePoint]) {
			let index = selectedRestorePoint;
			previewRestorePoint(restorePoints[selectedRestorePoint]).then((r) => {
				if (index === selectedRestorePoint) setData(r);
			});
		}
	}, [selectedRestorePoint]);
	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DialogTrigger asChild>
				<Button
					className="w-38.75 text-ellipsis h-12 overflow-hidden"
					style={{ width: leftSidebarOpen ? "" : "3rem", borderRadius: leftSidebarOpen ? "" : "999px" }}
				>
					<SaveAllIcon />
					{leftSidebarOpen && textData.Restore}
				</Button>
			</DialogTrigger>
			<DialogContent className="">
				<AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
					<AlertDialogContent className="min-w-120">
						<div className="max-w-96 flex flex-col items-center gap-6 mt-6 text-center">
							<div className="text-xl text-gray-200">
								{textData.Delete}{" "}
								<span className="text-accent ">{restorePoints[selectedRestorePoint]}</span>?
							</div>
							<div className="text-destructive ">{textData.Irrev}</div>
						</div>
						<div className="flex justify-between w-full gap-4 mt-4">
							<AlertDialogCancel variant="default" className="w-24 duration-300">
								{textData.Cancel}
							</AlertDialogCancel>
							<AlertDialogAction
								variant="destructive"
								className="w-24"
								onClick={async () => {
									if (
										selectedRestorePoint === null ||
										selectedRestorePoint === undefined ||
										!restorePoints[selectedRestorePoint]
									)
										return;
									if (await deleteRestorePoint(restorePoints[selectedRestorePoint])) {
										let newRPs = [...restorePoints];
										newRPs.splice(selectedRestorePoint, 1);
										setRestorePoints(newRPs);
										setSelectedRestorePoint(-1);
										setData([]);
									}
									setAlertOpen(false);
								}}
							>
								{textData.Delete}
							</AlertDialogAction>
						</div>
					</AlertDialogContent>
				</AlertDialog>
				<div className="min-h-fit text-accent my-6 text-3xl">{textData.Restore}</div>
				<div className="h-100 flex items-center w-full p-0">
					<div className="max-w-1/2 flex flex-col w-1/2 h-full pr-2">
						<div className="min-h-10 flex items-center justify-between w-full mb-2">
							{textData.RestorePoints}
						</div>
						<div className="data-wuwa:border flex flex-col w-full h-full overflow-x-hidden overflow-y-auto text-gray-300 border-0 rounded-sm">
							{
								<div className="data-wuwa:gap-0 data-wuwa:border data-wuwa:pr-0 flex flex-col w-full h-full gap-2 pr-1 overflow-x-hidden overflow-y-auto text-gray-300 border-0 border-b-0 rounded-sm rounded-b-none">
									{restorePoints.map((item, index) => (
										<Button
											onClick={() => {
												setSelectedRestorePoint(index);
											}}
											style={{
												backgroundColor:
													game == "WW"
														? selectedRestorePoint == index
															? "var(--border)"
															: index % 2 == 0
															? "#1b1b1b50"
															: "#31313150"
														: selectedRestorePoint == index
														? "var(--accent)"
														: "",
												color: game != "WW" && selectedRestorePoint == index ? "var(--background)" : "",
												animation: game != "WW" && selectedRestorePoint == index ? "" : "none",
											}}
											className={
												"w-full h-10 border-b  bgaccent bg-background/50 data-gi:bg-button rounded-none  zzz-border gap-2 flex items-center px-2"
											}
										>
											<Label className="w-full pointer-events-none">{item}</Label>
										</Button>
									))}
								</div>
							}
							<Button
								className="min-h-10 data-wuwa:bg-background/50 data-wuwa:mt-0 flex items-center justify-center w-full gap-2 px-2 mt-2 text-sm border rounded-b-sm"
								onClick={() => {
									if (disabled) return;
									setDialogOpen(false);
									createRestorePoint();
								}}
							>
								<PlusIcon className="w-4 h-4" /> {textData.CreateRestorePoint}
							</Button>
						</div>
					</div>
					<div className="max-w-1/2 flex flex-col w-1/2 h-full pl-2">
						<div className="min-h-10 flex items-center justify-between w-full mb-2">
							{textData.RestorePointContent}
							<Button
								className=" max-h-7 max-w-7"
								disabled={disabled || !restorePoints[selectedRestorePoint]}
								onClick={() => {
									if (disabled) return;
									setAlertOpen(true);
								}}
							>
								<Trash2Icon className="w-3 h-3 max-w-3.5 text-destructive hover:brightness-75 duration-200 pointer-events-none" />
							</Button>
						</div>
						<div className="flex flex-col w-full h-full overflow-x-hidden overflow-y-auto text-gray-300 border rounded-sm">
							{data.map((item, index) => (
								<div
									className={"w-full flex  flex-col"}
									style={{
										backgroundColor: index % 2 == 0 ? "#1b1b1b50" : "#31313150",
										borderBottom: index == data.length - 1 ? "0.0625rem solid var(--border)" : "",
									}}
								>
									<div
										className={
											"w-full h-10 flex gap-2 items-center px-2 " +
											(index !== 0 ? "border-t " : "") +
											(index !== data.length - 1 || (item.children?.length || 0) > 0 ? "border-b" : "")
										}
									>
										{item.icon ? (
											<img
												src={item.icon}
												onError={(e) => {
													e.currentTarget.src = "/who.jpg";
												}}
												className="w-6 h-6 -ml-1 -mr-1 overflow-hidden rounded-full"
												alt="icon"
											/>
										) : item.name == UNCATEGORIZED ? (
											<FolderCogIcon className="aspect-square w-5 h-5 -mr-1 pointer-events-none" />
										) : (
											<FolderIcon className="w-4 h-4" />
										)}
										<Label className={"w-full pointer-events-none " + ((index % 2) + 1)}>{item.name}</Label>
									</div>
									<div className="flex flex-col items-center w-full pl-4">
										{item.children?.map((child, index2) => (
											<div
												className={"w-full h-10 border-l flex gap-2 items-center px-2 "}
												style={{
													backgroundColor: index2 % 2 == 0 ? "#1b1b1b50" : "#31313150",
													borderBottom: index2 == item.children.length - 1 ? "" : "0.0625rem dashed var(--border)",
												}}
											>
												{child.isDir ? <FolderIcon className="w-4 h-4" /> : <FileIcon className="w-4 h-4" />}
												<Label className={"w-full pointer-events-none" + ((index2 % 2) + 1)}>{child.name}</Label>
											</div>
										))}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
				<div className="flex items-center justify-end w-full h-10 mt-2">
					
					<div className="text-muted-foreground w-full">
						{disabled && textData.Restricted}
					</div>
					<Button
						className="w-28"
						disabled={disabled}
						onClick={async () => {
							if (selectedRestorePoint > -1 && selectedRestorePoint < restorePoints.length) {
								setDialogOpen(false);
								restoreFromPoint(restorePoints[selectedRestorePoint]);
							} else {
								alert(textData.PleaseSelect);
							}
						}}
					>
						{textData.Restore}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default Restore;

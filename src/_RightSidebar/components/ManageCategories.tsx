import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteCategory, saveConfigs } from "@/utils/filesys";
import { setCategories } from "@/utils/init";

import { CATEGORIES, SETTINGS, TEXT_DATA } from "@/utils/vars";
import { Label } from "@radix-ui/react-dropdown-menu";
import { useAtom, useAtomValue } from "jotai";
import { EditIcon, RefreshCwIcon, TrashIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

function useDebouncedCallback<T extends (...args: any[]) => void>(callback: T, delay = 200) {
	const timerRef = useRef<number | null>(null);
	return useCallback(
		(...args: Parameters<T>) => {
			if (timerRef.current) clearTimeout(timerRef.current);
			timerRef.current = setTimeout(() => {
				callback(...args);
			}, delay);
		},
		[callback, delay]
	);
}
function ManageCategories() {
	const [alertOpen, setAlertOpen] = useState(false);
	const [alertData, setAlertData] = useState({
		_idRow: -1,
		_sName: "",
		_nItemCount: 0,
		_nCategoryCount: 0,
		_sUrl: "",
		_sIconUrl: "",
		_sAltIconUrl: "",
		index: -1,
	} as any);
	const [settings, setSettings] = useAtom(SETTINGS);
	const customCategories = settings.game.customCategories || ({} as any);
	const textData = useAtomValue(TEXT_DATA);
	const categories = useAtomValue(CATEGORIES);
	const categorySet = new Set(categories.map((cat) => cat._sName));
	const debouncedIconUpdate = useDebouncedCallback((value: string) => {
		setAlertData((prev: any) => {
			const curData = { ...prev };
			if (curData._idRow) {
				if (curData._sAltIconUrl && curData._sAltIconUrl === value) {
					curData._sAltIconUrl = "";
				} else if (curData._sIconUrl !== value && (!curData._sAltIconUrl || curData._sAltIconUrl.length === 0)) {
					curData._sAltIconUrl = curData._sIconUrl;
				}
			}
			curData._sIconUrl = value;
			return curData;
		});
	}, 400);
	return (
		<DialogContent>
			<Tooltip>
				<TooltipTrigger></TooltipTrigger>
				<TooltipContent className="opacity-0"></TooltipContent>
			</Tooltip>
			<AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
				<AlertDialogContent>
					<div className="max-w-96 flex flex-col items-center gap-2 mt-6 text-center">
						<img
							className="aspect-square outline bg-accent/10 z-10 flex items-center justify-center h-20 text-white rounded-full pointer-events-none"
							onError={(e) => {
								e.currentTarget.src = "/who.jpg";
							}}
							src={alertData._sIconUrl || "err"}
						/>

						<Input
							type="text"
							defaultValue={alertData._sName}
							disabled={!alertData.creating}
							onChange={(e) => {
								setAlertData((prev: any) => ({ ...prev, _sName: e.target.value }));
							}}
							placeholder={textData.CatName}
							style={{
								borderColor: alertData.creating && categorySet.has(alertData._sName) ? "var(--destructive)" : "",
							}}
							className=" disabled:border-0 max-w-80 text-ellipsis overflow-hidden text-center break-words"
						/>
						<Tooltip>
							<TooltipTrigger
								className="-mt-9  self-end duration-200"
								style={{
									opacity: !alertData._sUrl && !alertData.creating ? 1 : 0,
									pointerEvents: !alertData._sUrl && !alertData.creating ? "auto" : "none",
								}}
								onClick={async () => {
									const success = await deleteCategory(alertData._sName);
									if (success) {
										delete customCategories[alertData._sName];
										setSettings((prev) => ({
											...prev,
											game: {
												...prev.game,
												customCategories,
											},
										}));
										saveConfigs();
										setCategories();
										setAlertOpen(false);
									} else {
										const deleteWarning = document.getElementById("deleteWarning");
										if (deleteWarning) {
											deleteWarning.style.opacity = "1";
											setTimeout(() => {
												deleteWarning.style.opacity = "0";
												deleteWarning.style.pointerEvents = "none";
											}, 3000);
										}
									}
								}}
							>
								<TrashIcon className="h-5 p-0.5 w-5 text-destructive cursor-pointer hover:text-accent/70" />
							</TooltipTrigger>
							<TooltipContent>{textData.DeleteCat}</TooltipContent>
						</Tooltip>
						<label
							className="text-destructive -my-1 text-sm duration-300 pointer-events-none select-none"
							style={{
								opacity: alertData.creating && categorySet.has(alertData._sName) ? 1 : 0,
							}}
						>
							{textData.CatExist}
						</label>
						<div className="w-110 flex flex-col items-start gap-2">
							<label className="min-w-fit text-xs -mb-2 ml-2 bg-background text-accent border border-b-0 rounded-t-md px-1.5 py-0.5">
								{textData.IconURL}
							</label>
							<Input
								type="text"
								placeholder="https://custom.image.url/here"
								defaultValue={alertData._sIconUrl}
								disabled={!!alertData.name}
								onChange={(e) => {
									debouncedIconUpdate((e.target as HTMLInputElement).value);
								}}
								className="disabled:border-0 min-w-fit max-w-110 text-ellipsis w-full overflow-hidden break-words"
							/>

							<Tooltip>
								<TooltipTrigger
									className="-mt-9 self-end -mr-6.5 duration-200"
									style={{
										opacity: alertData._sAltIconUrl ? 1 : 0,
										pointerEvents: alertData._sAltIconUrl ? "auto" : "none",
									}}
									onClick={() => {
										debouncedIconUpdate(alertData._sAltIconUrl || "");
									}}
								>
									<RefreshCwIcon className="h-5 p-0.5 w-5 text-accent cursor-pointer hover:text-accent/70" />
								</TooltipTrigger>
								<TooltipContent>{textData.ManageCategoriesReset}</TooltipContent>
							</Tooltip>
						</div>
					</div>
					<div className="flex items-center justify-between w-full gap-4 mt-4">
						<AlertDialogCancel className="w-24">{textData.Cancel}</AlertDialogCancel>
						<label
							id="deleteWarning"
							className="text-destructive text-xs duration-200 opacity-0 pointer-events-none"
							key={alertData._sName}
						>
							{textData.CannotDel}
						</label>
						<AlertDialogAction
							variant="success"
							className="w-24"
							onClick={async () => {
								if (alertData._sName.trim().length === 0 || (alertData.creating && categorySet.has(alertData._sName))) {
									return;
								}
								if (alertData._sUrl && !alertData._sAltIconUrl) {
									delete customCategories[alertData._sName];
								} else
									customCategories[alertData._sName] = {
										_sIconUrl: alertData._sIconUrl,
										...(alertData._sAltIconUrl ? { _sAltIconUrl: alertData._sAltIconUrl } : {}),
									};
								setSettings((prev) => ({
									...prev,
									game: {
										...prev.game,
										customCategories,
									},
								}));
								saveConfigs();
								setCategories();
								setAlertOpen(false);
							}}
						>
							{textData.Confirm}
						</AlertDialogAction>
					</div>
				</AlertDialogContent>
			</AlertDialog>
			<div className="min-h-fit text-accent my-6 text-3xl">
				{textData.ManageCat}
			</div>
			<div className="max-h-110 min-h-110 flex flex-wrap w-full h-full gap-2 p-2 overflow-x-hidden overflow-y-scroll text-gray-300 rounded-sm">
				{categories.map((cat) => (
					<div
						key={cat._sName}
						onClick={() => {
							setAlertData(cat);
							setAlertOpen(true);
						}}
						className="button-like border-1 bg-button hover:bg-accent/30 active:bg-accent/50 active:scale-90 group w-80 zzz-fg-text data-zzz:mt-1 flex items-center gap-2 p-2 duration-300 rounded-md select-none"
					>
						<img
							className="aspect-square outline bg-accent/10 z-10 flex items-center justify-center h-12 text-white rounded-full pointer-events-none"
							onError={(e) => {
								e.currentTarget.src = "/who.jpg";
							}}
							src={cat._sIconUrl || "err"}
						/>

						<Label
							// type="text"

							className="w-70 group-hover:text-accent text-ellipsis whitespace-nowrap overflow-hidden duration-300 border-0 pointer-events-none"
						>
							{cat._sName}
						</Label>

						<EditIcon className="z-20 h-full min-w-5 p-[0.1875rem] text-accent cursor-pointer" />
					</div>
				))}
			</div>
			<div className="flex items-end w-full">
				<Button
					variant="outline"
					className="w-full"
					onClick={() => {
						setAlertData({ _sName: "", _sIconUrl: "", _sAltIconUrl: "", creating: true });
						setAlertOpen(true);
					}}
				>
					{textData.ManageCategoriesCreateCat}
				</Button>
			</div>
		</DialogContent>
	);
}

export default ManageCategories;

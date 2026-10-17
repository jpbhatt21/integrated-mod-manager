import { addToast } from "@/_Toaster/ToastProvider";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { saveConfigs } from "@/utils/filesys";
import { Mod } from "@/utils/types";
import { getImageUrl, handleImageError } from "@/utils/utils";
import { DATA, LAST_UPDATED, MOD_LIST } from "@/utils/vars";
import { useAtom,  useSetAtom } from "jotai";
import {  RefreshCcwIcon, SaveIcon, Undo2Icon } from "lucide-react";
import { useEffect, useState } from "react";
function ModPreviewCrop({ item, setDialogType }: { item: any, setDialogType: (type: string) => void }) {
	const setData = useSetAtom(DATA);
	const setModList = useSetAtom(MOD_LIST);
	const [lastUpdated, setLastUpdated] = useAtom(LAST_UPDATED);
	const previewUrl = `${getImageUrl(item?.path)}?${lastUpdated}`;
	const [scale, setScale] = useState(1);
	const [mouseDown, setMouseDown] = useState(false);
	const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
	const [offset, setOffset] = useState({ x: 0, y: 0 });
	const [aspect, setAspect] = useState(1);
	const [disabled, setDisabled] = useState(false);
	useEffect(() => {
		setMouseDown(false);
		setOffset({ x: (item?.crop?.x || 0) * 1.5, y: (item?.crop?.y || 0) * 1.5 });
		setScale(item?.crop?.scale || 1);
		setAspect(item?.crop?.vertical ? 0.99 : 1);
	}, [item]);
	function newMouseEvent(e: React.MouseEvent<HTMLDivElement, MouseEvent>, scale: number) {
		if (disabled) return;
		const deltaX = mouseDown ? (e.clientX - mouseDownPos.x) / 1 : 0;
		const deltaY = mouseDown ? (e.clientY - mouseDownPos.y) / 1 : 0;
		const xRange = (aspect >= 1 ? scale * 232 * aspect - 224 : (scale - 1) * 224) * 0.75;
		const yRange = (aspect >= 1 ? scale * 232 - 232 : (scale * 224) / aspect - 232) * 0.75;
		setOffset((prev) => ({
			x: Math.max(-xRange, Math.min(xRange, prev.x - deltaX)),
			y: Math.max(-yRange, Math.min(yRange, prev.y - deltaY)),
		}));
		setMouseDownPos({ x: e.clientX, y: e.clientY });
	}
	return (
		<DialogContent className="min-w-250 select-none">
			<Tooltip>
				<TooltipTrigger></TooltipTrigger>
				<TooltipContent className="opacity-0"></TooltipContent>
			</Tooltip>

			<div className="min-h-fit text-accent text-3xl">{"Edit Preview Image"}</div>
			<div className="text-gray-300 opacity-0 -mb-105 relative flex flex-col max-h-105 min-h-105 overflow-hidden rounded-sm">
				<img
					className="w-full h-full max-w-220 max-h-105 opacity- 0 brightness-40 object-cover object-center"
					src={previewUrl}
					onError={(e) => handleImageError(e)}
					onLoad={(e) => {
						const img = e.currentTarget;
						const w = img.naturalWidth;
						const h = img.naturalHeight;
						// setImageDim({ w, h });
						setAspect(w / h);
					}}
					id="mainimg"
				/>
			</div>
			<div className="min-w-full min-h-120 flex items-center justify-center overflow-hidden rounded-lg border border-dashed">
				<div
					className="relative fadein w-84 h-87 flex items-center justify-center duration-200 rounded-lg pointer--none"
					style={{
						overflow: "visible",
					}}
					onWheel={(e) => {
						if (disabled) return;
						const scaleAmount = e.deltaY < 0 ? 0.05 : -0.05;
						const newScale = Math.max(1, Math.min(4, scale + scaleAmount * scale));
						setScale(newScale);
						newMouseEvent(e, newScale);
					}}
					onMouseDown={(e) => {
						setMouseDown(true);
						setMouseDownPos({ x: e.clientX, y: e.clientY });
					}}
					onMouseUp={() => {
						setMouseDown(false);
					}}
					onMouseMove={(e) => {
						if (!mouseDown) return;
						newMouseEvent(e, scale);
					}}
					onMouseLeave={() => {
						setMouseDown(false);
					}}
				>
					<img
						style={{
							left: `${-offset.x}px`,
							top: `${-offset.y}px`,
							scale: scale,
							minWidth: aspect >= 1 ? "fit-content" : "14rem",
							minHeight: aspect >= 1 ? "14.5rem" : "fit-content",
						}}
						id="prevImg"
						className="w-full relative h-full brightness-50 object-contain object-center"
						draggable={false}
						src={previewUrl}
						onError={(e) => {
							handleImageError(e);
							setDisabled(true);
						}}
					/>
					<div className="absolute top-0 w-full h-full border-2 backdrop-brightness-200 rounded-lg border-accent"></div>
				</div>
			</div>
			<div className="flex items-center w-full -my-1 justify-between">
				<Button
					variant="destructive"
					onClick={() => {
						setScale(1);
						setOffset({ x: 0, y: 0 });
					}}
					disabled={disabled || (scale == 1 && offset.x == 0 && offset.y == 0)}
				>
					<Undo2Icon /> Reset Changes
				</Button>
				<Button
				onClick={()=>setDialogType("preview")}
				>
					<RefreshCcwIcon />
					Change Image
				</Button>
				<Button
					variant="success"
					onClick={() => {
						const crop = {
							...(scale && { scale }),
							...(offset.x && { x: (offset.x * 2) / 3 }),
							...(offset.y && { y: (offset.y * 2) / 3 }),
							...(aspect < 1 && { vertical: true }),
						};
						setData((prev) => {
							prev[item.path] = {
								...prev[item.path],
								crop,
							};
							if (offset.x == 0 && offset.y == 0 && scale == 1) delete prev[item.path].crop;
							setModList((prev) =>
								prev.map((mod) => (mod.path === item.path ? ({ ...mod, crop: crop || {} } as Mod) : mod))
							);
							return { ...prev };
						});
						saveConfigs();
						setLastUpdated(Date.now());
						addToast({
							message: "Image updated successfully.",
							type: "success",
						});
						const curDialog = document.getElementById("radix-_r_q_")
						if (curDialog) (curDialog.lastElementChild as HTMLButtonElement)?.click()
					}}
					disabled={disabled || ((scale == item?.crop?.scale || (!item?.crop?.scale && scale==1)) && (offset.x == item?.crop?.x*1.5 || (!item?.crop?.x && !offset.x)) && (offset.y == item?.crop?.y*1.5 || (!item?.crop?.y && !offset.y)))}
				>
					<SaveIcon />
					Apply Changes
				</Button>
			</div>
		</DialogContent>
	);
}

export default ModPreviewCrop;
``;

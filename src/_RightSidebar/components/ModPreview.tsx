import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { savePreviewImageFromData } from "@/utils/filesys";
import { PREVIEW_CAPTURE_TARGET, TEXT_DATA } from "@/utils/vars";
import { useAtomValue, useSetAtom } from "jotai";
import { CameraIcon, UploadIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
function ModPreview({
	item,
	setDialogType,
}: {
	item: any;
	setDialogType: (type: string) => void;
	isBlank: boolean;
}) {
	const textData = useAtomValue(TEXT_DATA);
	const setCaptureTarget = useSetAtom(PREVIEW_CAPTURE_TARGET);
	const onDrop = useCallback(
		async (acceptedFiles: File[]) => {
			if (acceptedFiles.length == 0) return;
			const file = acceptedFiles[0];
			const extension = file.type.split("/").pop() || "png";
			// Read file as ArrayBuffer and convert to Uint8Array
			const arrayBuffer = await file.arrayBuffer();
			const data = new Uint8Array(arrayBuffer);
			await savePreviewImageFromData(item.path, extension, data);
			setDialogType("preview-crop");
		},
		[item.path, setDialogType]
	);

	const inputRef = useRef<HTMLInputElement>(null);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		multiple: false,
		accept: {
			"image/png": [".png"],
			"image/jpeg": [".jpg", ".jpeg"],
			"image/gif": [".gif"],
			"image/webp": [".webp"],
		},
		noClick: true,
	});
	useEffect(() => {
		function handlePaste(event: ClipboardEvent) {
			const items = event.clipboardData?.items;
			if (!items) return;
			for (const item of items) {
				if (item.kind === "file" && item.type.startsWith("image/")) {
					const file = item.getAsFile();
					if (file) {
						onDrop([file]);
						event.preventDefault();
						break;
					}
				} else if (item.kind === "string" && item.type === "text/plain") {
					item.getAsString((str) => {
						if (str.startsWith("http")) {
							fetch(str)
								.then((res) => res.blob())
								.then((blob) => {
									const file = new File([blob], "clipboard_image", { type: blob.type });
									if (file && file.type.startsWith("image/")) onDrop([file]);
								})
								.catch((err) => {
									console.error("Failed to fetch image from URL:", err);
								});
						}
					});
				}
			}
		}
		document.addEventListener("paste", handlePaste);
		return () => {
			document.removeEventListener("paste", handlePaste);
		};
	}, []);

	return (
		<DialogContent className=" select-none min-w-136 min-h-0">
			<Tooltip>
				<TooltipTrigger></TooltipTrigger>
				<TooltipContent className="opacity-0"></TooltipContent>
			</Tooltip>

			<div className="min-h-fit text-accent mb-4 text-3xl">{textData.Others.setPreview}</div>

			<div
				{...getRootProps({
					className: `h-64 w-128 border-[0.09375rem] border-dashed rounded items-center justify-center flex flex-col transition-colors ${
						isDragActive ? "border-accent bg-accent/10" : "border-accent/30"
					}`,
				})}
			>
				<input {...getInputProps()} ref={inputRef} />
				{isDragActive ? (
					<p className="text-accent">{textData.Others.dropImage}</p>
				) : (
					<div className="w-full h-full flex items-center justify-center text-accent/50">
						<div className="w-1/2 h-full flex flex-col items-center justify-center text-sm gap-4">
							<Button
								className="min-w-36"
								onClick={(e) => {
									e.stopPropagation();
									inputRef.current?.click();
								}}
								type="button"
							>
								{textData._RightSideBar._components._ModPreferences.Select}
							</Button>
							<Button
								className="min-w-36"
								onClick={(event) => {
									event.stopPropagation();
									setCaptureTarget({ path: item.path, name: item.name });
								}}
								type="button"
							>
								<CameraIcon className="h-4 w-4" /> Capture from game
							</Button>
							<label className="text-xs text-gray-400">OR</label>
							<label className="text-accent">{textData.Others.pasteImage}</label>
						</div>
						<div className="w-1/2 border-l h-full flex flex-col gap-2 items-center justify-center">
							<UploadIcon className="w-6 h-6" />
							<label className="text-sm text-accent text-center">{textData.Others.dragImage}</label>
						</div>
					</div>
				)}
			</div>
		</DialogContent>
	);
}

export default ModPreview;

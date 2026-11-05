import { AlertDialog, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
// import { VERSION } from "@/utils/consts";

import { NOTICE, NOTICE_OPEN, TEXT_DATA, UPDATER_OPEN } from "@/utils/vars";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { TriangleAlertIcon, Undo2Icon, UploadIcon } from "lucide-react";
import { useEffect, useState } from "react";
let timer = null as any;
function Notice() {
	const [noticeOpen, setNoticeOpen] = useAtom(NOTICE_OPEN);
	const setUpdateeOpen = useSetAtom(UPDATER_OPEN);
	const notice = useAtomValue(NOTICE);
	const [counter, setCounter] = useState(10);
	useEffect(() => {
		let interval = null as any;
		if (noticeOpen) {
			if (timer) clearInterval(timer);
			if (notice.timer > 0) {
				let count = notice.timer;
				setCounter(count);
				interval = setInterval(() => {
					count -= 1;
					setCounter(count);
					if (count <= 0) {
						clearInterval(interval);
					}
				}, 1000);
			}
		}
		return () => interval && clearInterval(interval);
	}, [notice, noticeOpen]);
	//info(notice.ignoreable)
	const textData = useAtomValue(TEXT_DATA);
	return (
		<AlertDialog open={noticeOpen}>
			<AlertDialogTrigger asChild>
				<Button
					onClick={() => setNoticeOpen(true)}
					className="aspect-square text-ellipsis bg-sidebar flex flex-col h-full p-0 overflow-hidden text-xs border"
					style={{
						width: notice.id == 0 ? "0px" : "auto",
						marginRight: notice.id == 0 ? "-0.75rem" : "0px",
						opacity: notice.id == 0 ? "0" : "1",
						pointerEvents: notice.id == 0 ? "none" : "auto",
					}}
				>
					<div
						className={`w-full h-full flex items-center justify-center ${
							["alert-red", "alert-yellow"][notice.ignoreable] || ""
						}`}
					>
						<TriangleAlertIcon className="mx-auto mb-0.5" />
					</div>
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<div className="max-w-96 flex flex-col items-center gap-6 mt-6 text-center">
					<div className="text-xl text-accent">{notice.heading}</div>
					<div className={["text-destructive","text-warn"][notice.ignoreable] || "text-foreground/80"}>
						{notice.subheading}
					</div>
				</div>
				<div className="flex justify-between w-full gap-4 mt-4">
					<Button
						onClick={() => setNoticeOpen(false)}
						disabled={counter > 0}
						className="w-28 justify-between duration-300"
					>
						<Undo2Icon />
						<label className="min-w-16 w-16 text-center">{counter > 0 ? counter : textData.Cancel}</label>
					</Button>
					<Button
						onClick={() => {
							setNoticeOpen(false);
							timer = setTimeout(() => {
								setUpdateeOpen(true);
							}, 300);
						}}
						className="w-28 data-zzz:text-accent justify-between duration-300"
					>
						<UploadIcon />
						{textData.Update}
					</Button>
				</div>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export default Notice;

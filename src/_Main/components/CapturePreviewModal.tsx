import { addToast } from "@/_Toaster/ToastProvider";
import { Button } from "@/components/ui/button";
import { managedSRC } from "@/utils/consts";
import { saveConfigs } from "@/utils/filesys";
import {
	DATA,
	GAME,
	LAST_UPDATED,
	MOD_LIST,
	PREVIEW_CAPTURE_OVERLAY,
	PREVIEW_CAPTURE_TARGET,
	SOURCE,
} from "@/utils/vars";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { isAbsolute, join } from "@tauri-apps/api/path";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { CheckIcon, Loader2Icon, RotateCcwIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";

interface Selection {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface CaptureBounds {
	left: number;
	top: number;
	width: number;
	height: number;
}

function clamp(value: number, minimum: number, maximum: number) {
	return Math.max(minimum, Math.min(maximum, value));
}

function selectionFromPoints(
	startX: number,
	startY: number,
	currentX: number,
	currentY: number,
	widthLimit: number,
	heightLimit: number
): Selection {
	const safeStartX = clamp(startX, 0, widthLimit);
	const safeStartY = clamp(startY, 0, heightLimit);
	const safeCurrentX = clamp(currentX, 0, widthLimit);
	const safeCurrentY = clamp(currentY, 0, heightLimit);
	return {
		x: Math.min(safeStartX, safeCurrentX),
		y: Math.min(safeStartY, safeCurrentY),
		width: Math.abs(safeCurrentX - safeStartX),
		height: Math.abs(safeCurrentY - safeStartY),
	};
}

function pointerInBounds(event: ReactMouseEvent<HTMLElement>, bounds: CaptureBounds) {
	const elementBounds = event.currentTarget.getBoundingClientRect();
	return {
		x: elementBounds.width ? ((event.clientX - elementBounds.left) / elementBounds.width) * bounds.width : 0,
		y: elementBounds.height ? ((event.clientY - elementBounds.top) / elementBounds.height) * bounds.height : 0,
	};
}

async function discardStage(path: string) {
	if (path) await invoke("discard_preview_capture_stage", { stagePath: path }).catch(() => {});
}

function CapturePreviewModal() {
	const [target, setTarget] = useAtom(PREVIEW_CAPTURE_TARGET);
	const setOverlayActive = useSetAtom(PREVIEW_CAPTURE_OVERLAY);
	const game = useAtomValue(GAME);
	const source = useAtomValue(SOURCE);
	const setLastUpdated = useSetAtom(LAST_UPDATED);
	const setData = useSetAtom(DATA);
	const setModList = useSetAtom(MOD_LIST);
	const dragStart = useRef<{ x: number; y: number } | null>(null);
	const [phase, setPhase] = useState<"idle" | "selecting" | "capturing" | "confirming">("idle");
	const [bounds, setBounds] = useState<CaptureBounds | null>(null);
	const [selection, setSelection] = useState<Selection | null>(null);
	const [dragging, setDragging] = useState(false);
	const [stagePath, setStagePath] = useState("");
	const [saving, setSaving] = useState(false);
	const [cameraControlActive, setCameraControlActive] = useState(false);
	const stageUrl = useMemo(() => (stagePath ? convertFileSrc(stagePath) : ""), [stagePath]);

	const closeCapture = useCallback(async () => {
		await invoke("cancel_preview_capture_overlay").catch(() => {});
		await discardStage(stagePath);
		setOverlayActive(false);
		setPhase("idle");
		setBounds(null);
		setSelection(null);
		setStagePath("");
		setCameraControlActive(false);
		setTarget(null);
	}, [setOverlayActive, setTarget, stagePath]);

	const beginSelection = useCallback(async () => {
		if (!target) return;
		await discardStage(stagePath);
		setStagePath("");
		setSelection(null);
		setPhase("selecting");
		setOverlayActive(true);
		try {
			const captureBounds = await invoke<CaptureBounds>("enter_preview_capture_overlay", { game });
			setBounds(captureBounds);
		} catch (error) {
			addToast({ type: "error", message: String(error) });
			await closeCapture();
		}
	}, [closeCapture, game, setOverlayActive, stagePath, target]);

	useEffect(() => {
		if (target && phase === "idle") beginSelection();
	}, [beginSelection, phase, target]);

	useEffect(() => {
		if (!target) return;
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			closeCapture();
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [closeCapture, target]);

	const captureSelection = async (nextSelection: Selection) => {
		if (!bounds || nextSelection.width < 8 || nextSelection.height < 8) return;
		setDragging(false);
		setPhase("capturing");
		try {
			const path = await invoke<string>("capture_preview_screen_region", {
				crop: {
					x: Math.round(bounds.left + nextSelection.x),
					y: Math.round(bounds.top + nextSelection.y),
					width: Math.round(nextSelection.width),
					height: Math.round(nextSelection.height),
				},
			});
			setStagePath(path);
			setOverlayActive(false);
			setPhase("confirming");
		} catch (error) {
			addToast({ type: "error", message: String(error) });
			await closeCapture();
		}
	};

	const pauseForCameraControl = async () => {
		if (phase !== "selecting") return;
		setCameraControlActive(true);
		setDragging(false);
		dragStart.current = null;
		try {
			await invoke("pause_preview_capture_overlay", { game });
		} catch (error) {
			addToast({ type: "error", message: String(error) });
		} finally {
			setCameraControlActive(false);
		}
	};

	const savePreview = async () => {
		if (!target || !stagePath) return;
		setSaving(true);
		try {
			const modPath = (await isAbsolute(target.path)) ? target.path : await join(source, managedSRC, target.path);
			const backupPath = await invoke<string | null>("save_mod_preview_stage", { stagePath, modPath });
			setData((previous) => {
				if (!previous[target.path]?.crop) return previous;
				const { crop: _crop, ...modData } = previous[target.path];
				return { ...previous, [target.path]: modData };
			});
			setModList((previous) =>
				previous.map((mod) => {
					if (mod.path !== target.path || !mod.crop) return mod;
					const { crop: _crop, ...nextMod } = mod;
					return nextMod;
				})
			);
			saveConfigs();
			setLastUpdated(Date.now());
			addToast({
				type: "success",
				message: backupPath ? "Preview saved. The previous image was backed up." : "Preview image saved.",
			});
			await closeCapture();
		} catch (error) {
			addToast({ type: "error", message: String(error) });
		} finally {
			setSaving(false);
		}
	};

	if (!target) return null;

	if (phase === "selecting" || phase === "capturing") {
		return (
			<div
				className={`fixed inset-0 z-[5000] select-none cursor-crosshair ${cameraControlActive ? "pointer-events-none bg-transparent" : "bg-black/10"}`}
				onContextMenu={(event) => event.preventDefault()}
				onMouseDown={(event) => {
					if (!bounds || phase !== "selecting") return;
					if (event.button === 2) {
						event.preventDefault();
						pauseForCameraControl();
						return;
					}
					if (event.button !== 0) return;
					dragStart.current = pointerInBounds(event, bounds);
					setSelection(null);
					setDragging(true);
				}}
				onMouseMove={(event) => {
					if (!bounds || !dragging || !dragStart.current || phase !== "selecting") return;
					const pointer = pointerInBounds(event, bounds);
					setSelection(
						selectionFromPoints(
							dragStart.current.x,
							dragStart.current.y,
							pointer.x,
							pointer.y,
							bounds.width,
							bounds.height
						)
					);
				}}
				onMouseUp={(event) => {
					if (event.button !== 0 || !bounds || !dragging || !dragStart.current || phase !== "selecting") return;
					const pointer = pointerInBounds(event, bounds);
					const nextSelection = selectionFromPoints(
						dragStart.current.x,
						dragStart.current.y,
						pointer.x,
						pointer.y,
						bounds.width,
						bounds.height
					);
					dragStart.current = null;
					setDragging(false);
					if (nextSelection.width < 8 || nextSelection.height < 8) {
						setSelection(null);
						return;
					}
					setSelection(nextSelection);
					captureSelection(nextSelection);
				}}
			>
				<div className="pointer-events-none absolute left-4 top-4 rounded-lg border bg-background/75 px-4 py-2 text-sm text-foreground shadow-lg backdrop-blur">
					{cameraControlActive
						? "Camera control active - release the right mouse button to resume"
						: "Drag to select a preview - hold the right mouse button to control the game camera - Esc cancels"}
				</div>
				{selection && bounds && (
					<div
						className="pointer-events-none absolute border-2 border-accent bg-accent/[0.06] shadow-[0_0_0_9999px_rgba(0,0,0,0.22)]"
						style={{
							left: `${(selection.x / bounds.width) * 100}%`,
							top: `${(selection.y / bounds.height) * 100}%`,
							width: `${(selection.width / bounds.width) * 100}%`,
							height: `${(selection.height / bounds.height) * 100}%`,
						}}
					/>
				)}
				{phase === "capturing" && (
					<div className="absolute inset-0 grid place-items-center bg-black/30">
						<div className="flex items-center gap-2 rounded-lg border bg-background/85 px-4 py-3 text-foreground backdrop-blur">
							<Loader2Icon className="h-5 w-5 animate-spin text-accent" /> Capturing preview...
						</div>
					</div>
				)}
			</div>
		);
	}

	if (phase === "confirming") {
		return (
			<div className="fixed inset-0 z-[5000] flex items-center justify-center bg-background/80 p-6 backdrop-blur-md">
				<div className="flex max-h-[94vh] w-full max-w-4xl flex-col rounded-xl border bg-sidebar p-4 shadow-2xl">
					<div className="mb-3 flex items-start justify-between gap-3">
						<div>
							<p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Confirm preview</p>
							<h2 className="text-2xl text-accent">{target.name}</h2>
							<p className="text-xs text-muted-foreground">Use this crop as the mod preview?</p>
						</div>
						<Button onClick={closeCapture} className="h-9 w-9 p-0" aria-label="Cancel capture">
							<XIcon className="h-4 w-4" />
						</Button>
					</div>
					<div className="grid min-h-[26rem] place-items-center overflow-hidden rounded-lg border bg-background/40">
						{stageUrl ? (
							<img src={stageUrl} className="max-h-[68vh] max-w-full rounded-md object-contain" />
						) : (
							<Loader2Icon className="h-8 w-8 animate-spin text-accent" />
						)}
					</div>
					<div className="mt-3 flex justify-end gap-3">
						<Button disabled={saving} onClick={beginSelection}>
							<RotateCcwIcon className="h-4 w-4" /> Recapture
						</Button>
						<Button variant="success" disabled={saving || !stagePath} onClick={savePreview}>
							{saving ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4" />}
							Use this preview
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return null;
}

export default CapturePreviewModal;

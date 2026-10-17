import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import type { CSSProperties } from "react";

// The window is borderless (decorations: false), so on Wayland there is no
// resize affordance. These invisible edge/corner handles call
// startResizeDragging so the window can be resized on every platform.
type Dir = "North" | "South" | "East" | "West" | "NorthEast" | "NorthWest" | "SouthEast" | "SouthWest";

const appWindow = getCurrentWindow();
const EDGE = 5; // px – edge thickness
const CORNER = 14; // px – corner box

const HANDLES: { dir: Dir; style: CSSProperties }[] = [
	{ dir: "North", style: { top: 0, left: CORNER, right: CORNER, height: EDGE, cursor: "ns-resize" } },
	{ dir: "South", style: { bottom: 0, left: CORNER, right: CORNER, height: EDGE, cursor: "ns-resize" } },
	{ dir: "West", style: { left: 0, top: CORNER, bottom: CORNER, width: EDGE, cursor: "ew-resize" } },
	{ dir: "East", style: { right: 0, top: CORNER, bottom: CORNER, width: EDGE, cursor: "ew-resize" } },
	{ dir: "NorthWest", style: { top: 0, left: 0, width: CORNER, height: CORNER, cursor: "nwse-resize" } },
	{ dir: "NorthEast", style: { top: 0, right: 0, width: CORNER, height: CORNER, cursor: "nesw-resize" } },
	{ dir: "SouthWest", style: { bottom: 0, left: 0, width: CORNER, height: CORNER, cursor: "nesw-resize" } },
	{ dir: "SouthEast", style: { bottom: 0, right: 0, width: CORNER, height: CORNER, cursor: "nwse-resize" } },
];

export async function scaleHandler(scale: number) {
	document.documentElement.style.fontSize = 16 * Math.pow(2, scale / 50) + "px";
	try {
		const newMin = new LogicalSize(1080 * Math.pow(2, scale / 50), 720 * Math.pow(2, scale / 50));
		const curSize = await appWindow.innerSize();
		const sc = await appWindow.scaleFactor();
		if (newMin.width * sc > curSize.width || newMin.height * sc > curSize.height) {
			await appWindow.setSize(newMin);
		}
		await appWindow.setMinSize(newMin).catch(() => {});
	} catch (e) {
		console.error("Error setting min size", e);
	}
}

export default function ResizeHandles() {
	return (
		<div className="pointer-events-none fixed inset-0 z-[3000]">
			{HANDLES.map((h) => (
				<div
					key={h.dir}
					className="pointer-events-auto fixed"
					style={h.style}
					onMouseDown={(e) => {
						if (e.button !== 0) return;
						e.preventDefault();
						appWindow.startResizeDragging(h.dir).catch(() => {});
					}}
				/>
			))}
		</div>
	);
}

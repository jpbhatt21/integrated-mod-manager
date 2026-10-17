import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import React from "react";
import { resetWithBackup } from "./filesys";
import { addToast } from "@/_Toaster/ToastProvider";
import { getCwd } from "./init";
import { join } from "./utils";
import { toFs } from "./pathsep";
import { readTextFile, writeTextFile } from "./fs";
import { open } from "@tauri-apps/plugin-dialog";
import { error } from "@/lib/logger";
import { invoke } from "@tauri-apps/api/core";
import Text from "@/textData.json";
const DISCORD_LINK = "https://discord.gg/QGkKzNapXZ";
const BANANA_LINK = "https://gamebanana.com/mods/593490";

type State = {
	hasError: boolean;
	error?: Error | null;
	info?: React.ErrorInfo | null;
};

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
	constructor(props: any) {
		super(props);
		this.state = { hasError: false, error: null, info: null };
	}

	static getDerivedStateFromError(error: Error) {
		return { hasError: true, error };
	}

	override componentDidCatch(err: Error, info: React.ErrorInfo) {
		// Save stack info for showing/copying and basic logging
		this.setState({ error: err, info });
		// Also log to console so devs can see it in logs
		// In future this could POST to a backend or a webhook
		// but currently there's no webhook configured in the repo.
		// Keep this synchronous and safe.
		try {
			error("Uncaught error:", err, info);
		} catch (e) {
			// ignore
		}
	}

	reload = () => {
		try {
			window.location.reload();
		} catch (e) {
			// fallback
			window.location.href = window.location.href;
		}
	};

	openDiscord = () => {
		try {
			window.open(DISCORD_LINK, "_blank");
		} catch (e) {
			// ignore
		}
	};

	copyDetails = async () => {
		const { error, info } = this.state;
		const payload = {
			message: error?.message || "No error message",
			stack: (error && (error.stack || "")) || "",
			componentStack: (info && info.componentStack) || "",
			userAgent: navigator.userAgent,
			time: new Date().toISOString(),
		};
		const text = JSON.stringify(payload, null, 2);
		try {
			await navigator.clipboard.writeText(text);
			// provide a small visual hint by temporarily changing title? keep simple
			// We don't show toast here to avoid adding new dependencies.
		} catch (e) {
			// ignore
		}
	};
	importer = async (error: string) => {
		try {
			const dialogOptions: any = {
				title: "Import Config",
				filters: [
					{
						name: "JSON files",
						extensions: ["json", "json.bak"],
					},
				],
			};

			dialogOptions.defaultPath = toFs(join(getCwd(), "backups"));

			const filePath = await open(dialogOptions);

			if (filePath) {
				const content = JSON.parse(await readTextFile(filePath as string));
				if (content && content.game && error.includes(content.game)) {
					await writeTextFile(`config${content.game}.json`, JSON.stringify(content, null, 2));
					window.location.reload();
				}
			}
		} catch (error) {
			addToast({ type: "error", message: "Error importing config" });
		}
	};

	override render() {
		if (!this.state.hasError) return this.props.children as React.ReactElement;
		const lang = JSON.parse(localStorage.getItem("imm-lang") || '"en"');
		const textData = Text[lang as keyof typeof Text] || Text["en"];
		const { error, info } = this.state;

		return (
			<>
				<div
					className="bg-bgg fixed w-screen h-screen"
					style={{
						opacity: 0.1,
						animation: "moveDiagonal 15s linear infinite",
					}}
				></div>
				<div className="w-full font-en flex flex-col backdrop-blur-xs gap-2 h-screen items-center justify-center bg-background/25 game-font">
					<img
						src="https://media.tenor.com/gSPV57XXMsAAAAAj/seseren.gif"
						style={{ objectFit: "cover", objectPosition: "0 -12px" }}
					/>
					<div className="text-accent text-5xl">{textData.Others.ohNo}</div>
					<div className="text-sm text-muted-foreground mb-4">{textData.Others.errOcc}</div>

					{error && (
						<div className="mb-4 text-sm text-destructive flex gap-2">
							<div className="font-medium">Error:</div>
							<pre className="whitespace-pre-wrap max-w-108">{error.message}</pre>
						</div>
					)}

					<div className="flex gap-2 mb-4">
						<Button className="w-36" onClick={this.reload} aria-label="Reload application">
							{textData._Checklist.Reload}
						</Button>

						{/* <button
							className="border border-accent text-accent px-3 py-1 rounded"
							onClick={this.openDiscord}
							aria-label="Open Discord report link"
						>
							Open Discord (report)
						</button> */}
						{error?.message.startsWith("Corrupted config file detected") && (
							<Button className="w-36" onClick={() => this.importer(error.message)} aria-label="Copy error details">
								{textData.Others.importConfig}
							</Button>
						)}
						<Button className="w-36" onClick={() => resetWithBackup()} aria-label="Copy error details">
							{textData.Others.backupReset}
						</Button>
						<Button className="w-36" onClick={() => invoke("open_logs_folder")} aria-label="Copy error details">
							{textData.Others.openLogs}
						</Button>
					</div>
					{info?.componentStack && (
						<Dialog>
							<DialogTrigger className="text-xs text-muted hover:brightness-125 duration-200">
								{textData.Others.showCompStack}
							</DialogTrigger>
							<DialogContent>
								<div className="min-h-fit text-accent my-6 text-3xl">
									{textData.Others.compStack}
									<Tooltip>
										<TooltipTrigger></TooltipTrigger>
										<TooltipContent className="opacity-0"></TooltipContent>
									</Tooltip>
								</div>
								<div className="max-h-[80vh] text-sm overflow-y-scroll">{info.componentStack}</div>
							</DialogContent>
						</Dialog>
					)}
					<div className="flex fixed bottom-4 items-center gap-2">
						<label className="opacity-50">{textData.Others.contactDev}</label>
						<a
							href={BANANA_LINK}
							target="_blank"
							className="hover:opacity-100 flex items-center gap-1 text-xs duration-200 opacity-50"
						>
							{" "}
							<img className="h-4" src="/GBLogo.png" /> <img className="h-3" src="/GBTitle.png" />
						</a>
						<label className="opacity-50">-</label>
						<a
							href={DISCORD_LINK}
							target="_blank"
							className="hover:opacity-100 flex items-center gap-1 text-xs duration-200 opacity-50"
						>
							{" "}
							<img className="h-6" src="/DCLogoTitle.svg" />
						</a>
					</div>
				</div>
			</>
		);
	}
}

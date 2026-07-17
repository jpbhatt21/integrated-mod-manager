import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { BANANA_LINK, DISCORD_LINK, VERSION } from "@/utils/consts";
import { getTimeDifference, isOlderThanOneDay } from "@/utils/utils";
import { IMM_UPDATE, SETTINGS, TEXT_DATA, UPDATER_OPEN } from "@/utils/vars";
import { Checkbox } from "@/components/ui/checkbox";
import { useAtom, useAtomValue } from "jotai";
import { CircleAlert, DownloadIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { saveConfigs } from "@/utils/filesys";
import Credits from "./Credits";


let prev = 0;
let counter = 3000;

function Updater() {
	const textData = useAtomValue(TEXT_DATA);
	const [update, setUpdate] = useAtom(IMM_UPDATE);
	const ref1 = useRef<HTMLDivElement>(null);
	const ref2 = useRef<HTMLDivElement>(null);
	const ref3 = useRef<HTMLDivElement>(null);
	const [updaterOpen, setUpdaterOpen] = useAtom(UPDATER_OPEN);
	const [settings, setSettings] = useAtom(SETTINGS);
	const preReleases = settings.global.preReleases;
	useEffect(() => {
		let interval: ReturnType<typeof setInterval>;
		if (update?.status === "ready" && counter == 3000)
			interval = setInterval(() => {
				if (ref3.current)
					ref3.current.innerHTML = textData.In.replace(
						"<s/>",
						Math.ceil(counter / 10).toString()
					);
				counter--;
				if (counter < 0) {
					update.raw?.install();
					clearInterval(interval);
				}
			}, 100);
			
	}, [update, ref3]);
	let maj = [];
	let min = [];
	let pat = [];
	if (update?.body) {
		let json = JSON.parse(update.body);
		//info(json)
		maj = json.major || [];
		min = json.minor || [];
		pat = json.patch || [];
	}

	return (
		<Dialog open={updaterOpen} onOpenChange={setUpdaterOpen}>
			<DialogTrigger asChild>
				<Button
					disabled={updaterOpen}
					className="bg-sidebar flex h-6 p-0 overflow-hidden text-xs pointer-events-auto"
				>
					<img src="IMMDecor.png" className="h-6.5 shrink-0 object-contain p-2 pr-0" />
					{update && update.status !== "ignored" ? (
						{
							available: (
								<>
									<div className=" min-w-fit text-background button-like bg-accent flex items-center justify-center w-full h-5 gap-1 px-2 rounded-sm pointer-events-none">
										<UploadIcon className="max-h-3.5" />
										<Label className=" w-fit text-xs pointer-events-none">{textData.Update}</Label>
									</div>
								</>
							),
							downloading: (
								<div className=" max-w-24 min-w-24 flex flex-col overflow-hidden border rounded-md">
									<div
										key={"down1"}
										className="fade-in max-w-24 min-w-24 min-h-5 z-10 w-full h-5 -mb-5 pointer-events-none"
									>
										<div
											ref={ref1}
											className="min-h-5 height-in bg-accent text-background hover:brightness-125 rounded-r-md flex flex-col self-start justify-center h-5 overflow-hidden"
											style={{ width: prev + "%" }}
										>
											<div className="min-w-24 fade-in flex items-center justify-center gap-1 pointer-events-none">
												<Loader2Icon className="h-3 max-h-3 w-3 max-w-3 -ml-0.5 -mt-0.5 animate-spin" />

												<Label className=" w-fit max-w-24 text-[0.6rem] pointer-events-none">
													{textData.Downloading}
												</Label>
											</div>
										</div>
									</div>

									<div
										key={"down2"}
										className="fade-in min-w-24 max-w-24 min-h-5 text-accent flex items-center justify-center w-full h-5 gap-1 pointer-events-none"
									>
										<Loader2Icon className="h-3 max-h-3 w-3 max-w-3 -ml-0.5 -mt-0.5 animate-spin" />

										<Label className=" w-fit max-w-24 text-[0.6rem] pointer-events-none">
											{textData.Downloading}
										</Label>
									</div>
								</div>
							),
							ready: (
								<div className=" min-w-fit text-background button-like bg-accent flex items-center justify-center w-full h-5 gap-1 px-2 rounded-sm pointer-events-none">
									<DownloadIcon className="max-h-3.5" />
									<Label className=" w-fit max-w-24 text-xs pointer-events-none">{textData.Install}</Label>
								</div>
							),
							error: (
								<div className=" min-w-fit text-background button-like bg-destructive flex items-center justify-center w-full h-5 gap-1 px-2 rounded-sm pointer-events-none">
									<CircleAlert className="max-h-3.5" />
									<Label className=" w-fit max-w-24 text-xs pointer-events-none">
										{textData.Error}
									</Label>
								</div>
							),
							installed: textData.Installed,
						}[update.status]
					) : (
						<div className="mr-1">{`v${VERSION}`}</div>
					)}
				</Button>
			</DialogTrigger>
			<DialogContent className="game-font">
				<div className="min-h-fit text-accent mt-6 text-3xl">{textData.Updater}</div>
				<div className="min-h-fit text-muted-foreground -mt-4">v{VERSION} ({import.meta.env.VITE_BUILD_ID})</div>
				<div className="min-h-fit text-muted-foreground -mt-4">
					<Credits/>
				</div>
				<div className="flex flex-col items-center justify-center w-full -mt-4 mb-6">
					<div className=" flex items-center gap-2">
						<Checkbox
							id="checkbox"
							className=" checked:bg-accent bgaccent"
							onCheckedChange={(checked) => {
								setSettings((prev) => ({
									...prev,
									global: {
										...prev.global,
										preReleases: checked ? true : false,
									},
								}));
								saveConfigs();
								setUpdate(
									(prev) =>
										prev && {
											...prev,
											status: checked || isOlderThanOneDay(prev.date || "") ? "available" : "ignored",
										}
								);
							}}
							checked={preReleases}
						/>
						<label className="text-muted-foreground text-sm">{textData.GetPre}</label>
					</div>
				</div>

				{update && update.status !== "ignored" && (
					<>
						<div className="min-h-2 text-accent w-full text-xl">
							Version {update.version}{" "}
							<span className="text-muted-foreground text-base">
								({getTimeDifference(Date.now() / 1000, new Date(update.date).getTime() / 1000)}{" "}
								{textData.ago})
							</span>
						</div>
						<Separator className="my-2" />
					</>
				)}
				<div className="h-72 max-h-72 flex flex-col w-full px-4 overflow-x-hidden overflow-y-auto">
					{update && update.status !== "ignored" ? (
						<>
							{maj.length > 0 && <div className="min-h-6 text-accent">{textData.Maj}:</div>}
							{maj.map((item: string, index: number) => (
								<div key={index} className="min-h-fit text-muted-foreground flex items-center gap-2 mt-1 text-lg">
									<div className="min-w-1 min-h-1 aspect-square bg-accent self-start mt-3 rounded-full"></div>
									<div>{item}</div>
								</div>
							))}
							{min.length > 0 && (
								<div className="min-h-6 text-accent mt-4">{textData.Min}:</div>
							)}
							{min.map((item: string, index: number) => (
								<div key={index} className="min-h-fit text-base text-muted-foreground flex items-center mt-0.5 gap-2">
									<div className="min-w-1 min-h-1 self-start mt-2.5 aspect-square bg-accent rounded-full"></div>
									<div>{item}</div>
								</div>
							))}
							{pat.length > 0 && (
								<div className="min-h-6 text-accent mt-4">{textData.Patch}:</div>
							)}
							{pat.map((item: string, index: number) => (
								<div key={index} className="min-h-fit text-muted-foreground flex items-center gap-2 mt-0.5">
									<div className="min-w-1 min-h-1 self-start mt-2.5 aspect-square bg-accent rounded-full"></div>
									<div>{item}</div>
								</div>
							))}
						</>
					) : (
						<div className="text-muted-foreground flex flex-col items-center justify-center w-full h-full">
							{textData.Lat}
							<div className="mt-124 absolute flex items-center gap-2">
								<label className="opacity-40">{textData.BFR}</label>
								<label>:</label>
								<a
									href={BANANA_LINK}
									target="_blank"
									className="hover:opacity-100 flex items-center gap-1 text-xs duration-200 opacity-50"
								>
									{" "}
									<img className="h-4" src="/GBLogo.png" /> <img className="h-3" src="/GBTitle.png" />
								</a>
								|
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
					)}
				</div>
				{update && update.status !== "ignored" && (
					<div className="flex items-center justify-end w-full h-10 mt-2">
						<div ref={ref3} className="text-muted-foreground w-full text-xs">
							{update.status == "ready" ? (
								<>{textData.Soon}</>
							) : (
								textData.Use
							)}
						</div>
						<Button
							className="w-28"
							disabled={update.status == "downloading" || update.status == "installed"}
							// disabled={disabled}
							onClick={async () => {
								if ((update.status === "available" || update.status === "error") && update.raw) {
									let downloaded = 0;
									let contentLength = 0;

									await update.raw?.download((event: any) => {
										switch (event.event) {
											case "Started":
												contentLength = event.data.contentLength;
												setUpdate((prev) => (prev ? { ...prev, status: "downloading" } : prev));
												break;
											case "Progress":
												downloaded += event.data.chunkLength;
												prev = Math.floor((downloaded / contentLength) * 100);
												if (ref1.current) ref1.current.style.width = prev + "%";
												if (ref2.current) ref2.current.innerHTML = `${prev}%`;
												break;
											case "Finished":
												counter = 3000;
												setUpdate((prev) => (prev ? { ...prev, status: "ready" } : prev));
												setUpdaterOpen(true);
												break;
										}
									});
								} else if (counter > 0) {
									update.raw?.install();
								}
							}}
						>
							<div ref={ref2}>
								{
									{
										available: textData.Update,
										downloading: textData.Downloading,
										ready: textData.InstallNow,
										error: textData.Retry,
										installed: textData.Installed,
									}[update.status]
								}
							</div>
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

export default Updater;

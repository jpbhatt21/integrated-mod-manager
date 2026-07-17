import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { BANANA_LINK, DISCORD_LINK } from "@/utils/consts";
import { confirmAndCancelDownloadsForGameSwitch } from "@/utils/downloadManager";
import { resetWithBackup } from "@/utils/filesys";
import { GAME, SOURCE, TARGET, TEXT_DATA, UPDATER_OPEN } from "@/utils/vars";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { BadgeHelpIcon } from "lucide-react";

function Help({ setPage }: { setPage: (page: number) => void }) {
	const [game, setGame] = useAtom(GAME);
	const setSource = useSetAtom(SOURCE);
	const setTarget = useSetAtom(TARGET);
	const textData = useAtomValue(TEXT_DATA);
	const setUpdaterOpen = useSetAtom(UPDATER_OPEN);
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button className="w-38.75 showAfterDelay fixed bottom-5 left-1/2 -translate-x-1/2  text-ellipsis h-12 overflow-hidden">
					<BadgeHelpIcon className="aspect-square h-full" /> {textData.Help}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<header className="my-6 space-y-1 text-center">
					<h2 className="text-foreground text-2xl font-semibold">{textData.Help}</h2>
					<p className="text-muted-foreground text-sm">{textData.QuickChecks}</p>
				</header>
				<section className="space-y-4">
					<div className="border-border/40 bg-sidebar/20 flex items-center justify-between gap-3 p-3 py-6 border rounded-md">
						<div className="text-sm text-left">
							<h3 className="text-foreground font-medium">{textData.WrongGame}</h3>
							<p className="text-muted-foreground text-xs">{textData.SwitchGames}</p>
						</div>
						<Button
							size="sm"
							className="w-24"
							onClick={async () => {
								if (!(await confirmAndCancelDownloadsForGameSwitch())) return;
								setGame("");
								setPage(1);
							}}
						>
							{textData.Select}
						</Button>
					</div>
					<div className="border-border/40 bg-sidebar/20 flex items-center justify-between gap-3 p-3 py-6 border rounded-md">
						<div className="text-sm text-left">
							<h3 className="text-foreground font-medium">{textData.CorrectPath}</h3>
							<p className="text-muted-foreground text-xs">
								{textData.VerifyPath.replace("<game/>", game ? game : "XX")}
							</p>
						</div>
						<Button
							size="sm"
							className="w-24"
							onClick={() => {
								setSource("");
								setTarget("");
								setPage(2);
							}}
						>
							{textData.HelpChange}
						</Button>
					</div>
					<div className="border-border/40 bg-sidebar/20 flex items-center justify-between gap-3 p-3 py-6 border rounded-md">
						<div className="text-sm text-left">
							<h3 className="text-foreground font-medium">{textData.UpToDate}</h3>
							<p className="text-muted-foreground text-xs">{textData.UpdatesFix}</p>
						</div>
						<Button
							size="sm"
							className="w-24"
							onClick={() => {
								setUpdaterOpen(true);
							}}
						>
							{textData.Check}
						</Button>
					</div>
					<div className="border-border/40 bg-sidebar/20 flex items-center justify-between gap-3 p-3 py-6 border rounded-md">
						<div className="text-sm text-left">
							<h3 className="text-foreground font-medium">{textData.Backup}</h3>
							<p className="text-muted-foreground text-xs">{textData.CreateBKUP}</p>
							<p className="text-muted-foreground text-xs">{textData.ImportConfigs}</p>
						</div>
						<Button
							size="sm"
							className="text-destructive hover:bg-destructive hover:text-background w-24"
							onClick={() => resetWithBackup()}
						>
							{textData.Reset}
						</Button>
					</div>
				</section>
				<footer className="space-y-2 text-sm text-center">
					<p className="opacity-50">{textData.StillStuck}</p>

					<div className="flex items-center gap-2">
						<label className="opacity-50">{textData.ContactDev}</label>
						<a
							href={BANANA_LINK}
							target="_blank"
							className="hover:opacity-100 flex items-center gap-1 text-xs duration-200 opacity-50"
						>
							{" "}
							<img className="h-4" src="/GBLogo.png" />{" "}
							<img className="h-3" src="/GBTitle.png" />
						</a>
						<label className="opacity-50">-</label>
						<a
							href={DISCORD_LINK}
							target="_blank"
							className="hover:opacity-100 flex items-center gap-1 text-xs duration-200 opacity-50"
						>
							{" "}
							<img
								className="h-6"
								src="/DCLogoTitle.svg"
							/>
						</a>
					</div>
				</footer>
			</DialogContent>
		</Dialog>
	);
}

export default Help;

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GAME_NAMES } from "@/utils/consts";
import type { Games } from "@/utils/types";
import { getUserStats, type UserStats } from "@/utils/userStats";
import {
	ActivityIcon,
	ChartNoAxesColumnIncreasingIcon,
	DownloadIcon,
	Gamepad2Icon,
	KeyboardIcon,
	PackageCheckIcon,
	RefreshCwIcon,
	SlidersHorizontalIcon,
	ToggleLeftIcon,
	WandSparklesIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";

const GAME_ORDER: Exclude<Games, "">[] = ["WW", "ZZ", "GI", "SR", "EF"];

function StatTile({
	icon: Icon,
	label,
	value,
}: {
	icon: ComponentType<{ className?: string }>;
	label: string;
	value: number;
}) {
	return (
		<div className="border-border/70 bg-input/10 flex min-h-18 items-center gap-3 rounded-md border px-3 py-2">
			<Icon className="text-accent h-5 w-5 shrink-0" />
			<div className="min-w-0">
				<div className="text-muted-foreground break-words text-xs leading-tight">{label}</div>
				<div className="text-foreground text-xl tabular-nums">{value.toLocaleString()}</div>
			</div>
		</div>
	);
}

function UserStatsDialog({ game, textData }: { game: Games; textData: any }) {
	const labels = textData.Others;
	const [open, setOpen] = useState(false);
	const [stats, setStats] = useState<UserStats | null>(null);
	const [selectedGame, setSelectedGame] = useState<Exclude<Games, ""> | "">(game || "");

	const games = useMemo(() => {
		const recorded = new Set(Object.keys(stats?.games || {}));
		if (game) recorded.add(game);
		return GAME_ORDER.filter((key) => recorded.has(key));
	}, [game, stats]);
	const gameStats = selectedGame ? stats?.games[selectedGame] : undefined;
	const actionCount = (action: string) => gameStats?.actions[action as keyof typeof gameStats.actions] || 0;
	const modRows = Object.entries(gameStats?.mods || {})
		.sort(([, a], [, b]) => b.total - a.total)
		.slice(0, 10);
	const presetRows = Object.entries(gameStats?.presets || {})
		.sort(([, a], [, b]) => b.total - a.total)
		.slice(0, 10);

	const handleOpen = async (nextOpen: boolean) => {
		setOpen(nextOpen);
		if (!nextOpen) return;
		const nextStats = await getUserStats();
		setStats(nextStats);
		const available = GAME_ORDER.filter((key) => nextStats.games[key]);
		setSelectedGame((game && (nextStats.games[game] || !available.length) ? game : available[0]) || "");
	};

	return (
		<Dialog open={open} onOpenChange={handleOpen}>
			<DialogTrigger asChild>
				<Button className="bg-input/25 text-accent hover:text-background h-9 w-full text-sm" variant="ghost">
					<ChartNoAxesColumnIncreasingIcon className="h-4 w-4" />
					{labels.viewStats}
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-150 min-w-190 overflow-hidden">
				<div className="text-accent mt-5 flex min-h-fit items-center gap-2 text-2xl">
					<ChartNoAxesColumnIncreasingIcon className="h-6 w-6" />
					{labels.stats}
				</div>

				{games.length > 0 && (
					<Tabs value={selectedGame} onValueChange={(value) => setSelectedGame(value as Exclude<Games, "">)}>
						<TabsList className="w-full">
							{games.map((key) => (
								<TabsTrigger key={key} value={key} className="h-9 flex-1">
									<Gamepad2Icon className="h-4 w-4" />
									{GAME_NAMES[key]}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				)}

				{gameStats ? (
					<div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
						<div className="grid grid-cols-3 gap-2">
							<StatTile icon={ActivityIcon} label={labels.totalActions} value={gameStats.total} />
							<StatTile icon={PackageCheckIcon} label={labels.installs} value={actionCount("mod_installed")} />
							<StatTile icon={RefreshCwIcon} label={labels.updates} value={actionCount("mod_updated")} />
							<StatTile
								icon={ToggleLeftIcon}
								label={labels.toggles}
								value={actionCount("mod_enabled") + actionCount("mod_disabled")}
							/>
							<StatTile icon={WandSparklesIcon} label={labels.presetUses} value={actionCount("preset_applied")} />
							<StatTile
								icon={SlidersHorizontalIcon}
								label={labels.prefChanges}
								value={actionCount("mod_preferences_changed")}
							/>
							<StatTile
								icon={KeyboardIcon}
								label={labels.hotkeyChanges}
								value={actionCount("mod_hotkeys_changed") + actionCount("preset_hotkey_changed")}
							/>
							<StatTile icon={DownloadIcon} label={labels.trackedMods} value={Object.keys(gameStats.mods).length} />
							<StatTile icon={Gamepad2Icon} label={labels.appStarts} value={actionCount("app_started")} />
						</div>

						<div className="text-muted-foreground flex justify-between text-xs">
							<span>{`${labels.since}: ${new Date(gameStats.firstAt).toLocaleDateString()}`}</span>
							<span>{`${labels.lastActivity}: ${new Date(gameStats.lastAt).toLocaleString()}`}</span>
						</div>

						{modRows.length > 0 && (
							<div className="overflow-hidden rounded-md border">
								<div className="bg-muted/20 text-accent grid grid-cols-[minmax(12rem,1fr)_repeat(4,5rem)] gap-2 px-3 py-2 text-xs">
									<span>{labels.mods}</span>
									<span className="break-words text-right leading-tight">{labels.toggles}</span>
									<span className="break-words text-right leading-tight">{labels.installs}</span>
									<span className="break-words text-right leading-tight">{labels.updates}</span>
									<span className="break-words text-right leading-tight">{labels.prefChanges}</span>
								</div>
								{modRows.map(([path, item]) => (
									<div
										key={path}
										className="border-border/60 grid grid-cols-[minmax(12rem,1fr)_repeat(4,5rem)] gap-2 border-t px-3 py-2 text-xs"
									>
										<span className="truncate" title={path}>{path}</span>
										<span className="text-right tabular-nums">{item.enabled + item.disabled}</span>
										<span className="text-right tabular-nums">{item.installs}</span>
										<span className="text-right tabular-nums">{item.updates}</span>
										<span className="text-right tabular-nums">{item.preferenceChanges}</span>
									</div>
								))}
							</div>
						)}

						{presetRows.length > 0 && (
							<div className="overflow-hidden rounded-md border">
								<div className="bg-muted/20 text-accent grid grid-cols-[1fr_repeat(3,6rem)] gap-2 px-3 py-2 text-xs">
									<span>{labels.presets}</span>
									<span className="break-words text-right leading-tight">{labels.presetUses}</span>
									<span className="break-words text-right leading-tight">{labels.updates}</span>
									<span className="break-words text-right leading-tight">{labels.hotkeyChanges}</span>
								</div>
								{presetRows.map(([name, item]) => (
									<div key={name} className="border-border/60 grid grid-cols-[1fr_repeat(3,6rem)] gap-2 border-t px-3 py-2 text-xs">
										<span className="truncate" title={name}>{name}</span>
										<span className="text-right tabular-nums">{item.applied}</span>
										<span className="text-right tabular-nums">{item.updated}</span>
										<span className="text-right tabular-nums">{item.hotkeyChanges}</span>
									</div>
								))}
							</div>
						)}
					</div>
				) : (
					<div className="text-muted-foreground flex min-h-48 flex-col items-center justify-center gap-2 text-sm">
						<ActivityIcon className="h-8 w-8 opacity-50" />
						{labels.noStats}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

export default UserStatsDialog;

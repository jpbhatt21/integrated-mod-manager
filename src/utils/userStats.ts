import { warn } from "@/lib/logger";
import { atomicWriteTextFile, exists, readTextFile } from "./fs";
import type { Games } from "./types";
import { SETTINGS, store } from "./vars";

const STATS_FILE = "userStats.json";
const STATS_VERSION = 1;
const MAX_RECENT_EVENTS = 100;

export type UserStatAction =
	| "app_started"
	| "mod_enabled"
	| "mod_disabled"
	| "mod_installed"
	| "mod_updated"
	| "mod_deleted"
	| "mod_renamed"
	| "mod_preferences_changed"
	| "mod_hotkeys_changed"
	| "mod_defaults_changed"
	| "preset_applied"
	| "preset_created"
	| "preset_updated"
	| "preset_renamed"
	| "preset_deleted"
	| "preset_hotkey_changed";

type StatDetails = Record<string, string | number | boolean>;

interface CounterGroup {
	total: number;
	firstAt: string;
	lastAt: string;
	actions: Partial<Record<UserStatAction, number>>;
}

interface ModStats extends CounterGroup {
	enabled: number;
	disabled: number;
	installs: number;
	updates: number;
	preferenceChanges: number;
	hotkeyChanges: number;
	defaultChanges: number;
	presetToggles: number;
}

interface PresetStats extends CounterGroup {
	applied: number;
	created: number;
	updated: number;
	renamed: number;
	deleted: number;
	hotkeyChanges: number;
}

interface GameStats extends CounterGroup {
	daily: Record<string, Partial<Record<UserStatAction, number>>>;
	mods: Record<string, ModStats>;
	presets: Record<string, PresetStats>;
}

interface RecentStatEvent {
	action: UserStatAction;
	at: string;
	game: Games;
	count: number;
	mod?: string;
	preset?: string;
	details?: StatDetails;
}

export interface UserStats extends CounterGroup {
	version: number;
	games: Partial<Record<Exclude<Games, "">, GameStats>>;
	recent: RecentStatEvent[];
}

export interface TrackUserActionOptions {
	action: UserStatAction;
	game?: Games;
	count?: number;
	mod?: string;
	preset?: string;
	details?: StatDetails;
}

let cachedStats: UserStats | null = null;
let processingQueue = false;
const pendingEvents: Array<{
	options: TrackUserActionOptions;
	resolve: () => void;
}> = [];

function createCounter(now: string): CounterGroup {
	return { total: 0, firstAt: now, lastAt: now, actions: {} };
}

function createStats(now: string): UserStats {
	return { ...createCounter(now), version: STATS_VERSION, games: {}, recent: [] };
}

function createGameStats(now: string): GameStats {
	return { ...createCounter(now), daily: {}, mods: {}, presets: {} };
}

function createModStats(now: string): ModStats {
	return {
		...createCounter(now),
		enabled: 0,
		disabled: 0,
		installs: 0,
		updates: 0,
		preferenceChanges: 0,
		hotkeyChanges: 0,
		defaultChanges: 0,
		presetToggles: 0,
	};
}

function createPresetStats(now: string): PresetStats {
	return {
		...createCounter(now),
		applied: 0,
		created: 0,
		updated: 0,
		renamed: 0,
		deleted: 0,
		hotkeyChanges: 0,
	};
}

function increment(group: CounterGroup, action: UserStatAction, count: number, now: string) {
	group.total += count;
	group.lastAt = now;
	group.actions[action] = (group.actions[action] || 0) + count;
}

function updateModSummary(stats: ModStats, action: UserStatAction, count: number, source?: string) {
	if (action === "mod_enabled") stats.enabled += count;
	else if (action === "mod_disabled") stats.disabled += count;
	else if (action === "mod_installed") stats.installs += count;
	else if (action === "mod_updated") stats.updates += count;
	else if (action === "mod_preferences_changed") stats.preferenceChanges += count;
	else if (action === "mod_hotkeys_changed") stats.hotkeyChanges += count;
	else if (action === "mod_defaults_changed") stats.defaultChanges += count;
	if ((action === "mod_enabled" || action === "mod_disabled") && source === "preset") stats.presetToggles += count;
}

function updatePresetSummary(stats: PresetStats, action: UserStatAction, count: number) {
	if (action === "preset_applied") stats.applied += count;
	else if (action === "preset_created") stats.created += count;
	else if (action === "preset_updated") stats.updated += count;
	else if (action === "preset_renamed") stats.renamed += count;
	else if (action === "preset_deleted") stats.deleted += count;
	else if (action === "preset_hotkey_changed") stats.hotkeyChanges += count;
}

async function loadStats(): Promise<UserStats> {
	if (cachedStats) return cachedStats;
	const now = new Date().toISOString();
	if (!(await exists(STATS_FILE))) {
		cachedStats = createStats(now);
		return cachedStats;
	}
	try {
		const parsed = JSON.parse(await readTextFile(STATS_FILE)) as UserStats;
		if (!parsed || parsed.version !== STATS_VERSION || !parsed.games || !Array.isArray(parsed.recent)) {
			throw new Error("Unsupported user stats format");
		}
		cachedStats = parsed;
	} catch (error) {
		warn("[IMM] Could not read userStats.json; starting a new stats file:", error);
		cachedStats = createStats(now);
	}
	return cachedStats;
}

function record(stats: UserStats, options: TrackUserActionOptions) {
	const now = new Date().toISOString();
	const game = options.game || store.get(SETTINGS).global.game;
	const count = Math.max(1, Math.floor(options.count || 1));

	increment(stats, options.action, count, now);
	if (game) {
		const gameStats = stats.games[game] || createGameStats(now);
		stats.games[game] = gameStats;
		increment(gameStats, options.action, count, now);
		const day = now.slice(0, 10);
		gameStats.daily[day] ||= {};
		gameStats.daily[day][options.action] = (gameStats.daily[day][options.action] || 0) + count;

		if (options.mod) {
			const modStats = gameStats.mods[options.mod] || createModStats(now);
			gameStats.mods[options.mod] = modStats;
			increment(modStats, options.action, count, now);
			updateModSummary(modStats, options.action, count, String(options.details?.source || ""));
		}
		if (options.preset) {
			const presetStats = gameStats.presets[options.preset] || createPresetStats(now);
			gameStats.presets[options.preset] = presetStats;
			increment(presetStats, options.action, count, now);
			updatePresetSummary(presetStats, options.action, count);
		}
	}

	stats.recent.push({
		action: options.action,
		at: now,
		game,
		count,
		...(options.mod ? { mod: options.mod } : {}),
		...(options.preset ? { preset: options.preset } : {}),
		...(options.details && Object.keys(options.details).length ? { details: options.details } : {}),
	});
	if (stats.recent.length > MAX_RECENT_EVENTS) stats.recent.splice(0, stats.recent.length - MAX_RECENT_EVENTS);
}

async function processQueue() {
	if (processingQueue) return;
	processingQueue = true;
	try {
		await Promise.resolve();
		while (pendingEvents.length) {
			const batch = pendingEvents.splice(0);
			try {
				const stats = await loadStats();
				batch.forEach(({ options }) => record(stats, options));
				await atomicWriteTextFile(STATS_FILE, JSON.stringify(stats, null, 2));
			} catch (error) {
				warn("[IMM] Failed to update user stats:", error);
			} finally {
				batch.forEach(({ resolve }) => resolve());
			}
		}
	} finally {
		processingQueue = false;
		if (pendingEvents.length) void processQueue();
	}
}

export function trackUserAction(options: TrackUserActionOptions): Promise<void> {
	return new Promise((resolve) => {
		pendingEvents.push({
			options: { ...options, game: options.game || store.get(SETTINGS).global.game },
			resolve,
		});
		void processQueue();
	});
}

export function initializeUserStats(): Promise<void> {
	return trackUserAction({ action: "app_started" });
}

export async function getUserStats(): Promise<UserStats> {
	while (processingQueue || pendingEvents.length) {
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	return structuredClone(await loadStats());
}

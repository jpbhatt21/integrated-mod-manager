import { Button } from "@/components/ui/button";
import { Category, Mod } from "@/utils/types";
import { getImageUrl } from "@/utils/utils";
import {
	CATEGORIES,
	CATEGORY,
	FILTER,
	LAST_UPDATED,
	LOCAL_CATEGORY_FAVORITES,
	LOCAL_NAVIGATION_MODE,
	LOCAL_NAVIGATION_PAGE,
	MOD_LIST,
	SEARCH,
	SORT,
} from "@/utils/vars";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ArrowLeftIcon, FolderOpenIcon, HeartIcon, ImageOffIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import MainLocal from "./MainLocal";

interface CategoryCard {
	name: string;
	icon: Category["_sIconUrl"];
	mods: Mod[];
	favorite: boolean;
}

function MainLocalNavigation() {
	const mode = useAtomValue(LOCAL_NAVIGATION_MODE);
	const vertical = mode === "vertical";
	const [page, setPage] = useAtom(LOCAL_NAVIGATION_PAGE);
	const categories = useAtomValue(CATEGORIES);
	const mods = useAtomValue(MOD_LIST);
	const lastUpdated = useAtomValue(LAST_UPDATED);
	const selectedCategories = useAtomValue(CATEGORY);
	const [favoriteCategories, setFavoriteCategories] = useAtom(LOCAL_CATEGORY_FAVORITES);
	const [search, setSearch] = useAtom(SEARCH);
	const setCategory = useSetAtom(CATEGORY);
	const setFilter = useSetAtom(FILTER);
	const setSort = useSetAtom(SORT);

	useEffect(() => {
		if (mode !== "classic" && selectedCategories.size > 0) setPage("mods");
	}, [mode, selectedCategories, setPage]);

	const categoryCards = useMemo<CategoryCard[]>(() => {
		const favorites = new Set(favoriteCategories);
		return categories
			.map((category) => ({
				name: category._sName,
				icon: category._sIconUrl,
				mods: mods.filter((mod) => mod.parent === category._sName),
				favorite: favorites.has(category._sName),
			}))
			.filter((card) => card.mods.length > 0)
			.sort((a, b) => {
				if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
				return a.name.localeCompare(b.name);
			});
	}, [categories, favoriteCategories, mods]);

	if (mode === "classic") return <MainLocal />;

	const resetNavigationFilters = () => {
		setCategory(new Set());
		setFilter((previous) => ({
			...previous,
			tag: { ...(previous.tag as Record<string, string>), fav: "any" },
		}));
		setSort("default");
	};

	const openCategory = (categoryName: string) => {
		resetNavigationFilters();
		setCategory(new Set([categoryName]));
		setPage("mods");
	};

	const toggleCategoryFavorite = (event: React.MouseEvent, categoryName: string) => {
		event.preventDefault();
		event.stopPropagation();
		setFavoriteCategories((previous) =>
			previous.includes(categoryName)
				? previous.filter((name) => name !== categoryName)
				: [...previous, categoryName]
		);
	};

	if (page === "mods" || search.trim()) {
		return (
			<div className="flex h-full w-full flex-col overflow-hidden">
				<div className={vertical ? "sticky top-0 z-10 flex w-full items-center bg-background/80 px-2 pb-1 backdrop-blur-sm" : "flex w-full items-center px-2 pb-1"}>
					<Button
						variant="ghost"
						className="h-9 gap-2"
						onClick={() => {
							resetNavigationFilters();
							setSearch("");
							setPage("categories");
						}}
					>
						<ArrowLeftIcon className="h-4 w-4" /> Back to categories
					</Button>
				</div>
				<div className="min-h-0 flex-1">
					<MainLocal compact={vertical} />
				</div>
			</div>
		);
	}

	return (
		<div className={`h-full w-full overflow-y-auto pb-6 ${vertical ? "px-3" : "px-5"}`}>
			<div className="sticky top-0 z-20 border-b bg-background/95 px-1 py-4 backdrop-blur">
				<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent">Mod library</p>
				<h2 className="font-serif text-3xl text-accent">Browse by category</h2>
				<p className="text-xs text-muted-foreground">
					{mods.length} total mods · Open a category folder to view its mods.
				</p>
			</div>
			<div className={`grid w-full justify-start pt-4 ${vertical ? "grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3" : "grid-cols-[repeat(auto-fill,19rem)] gap-5"}`}>
				{categoryCards.map((card) => {
					const firstPreview = card.mods[0];
					const enabledCount = card.mods.filter((mod) => mod.enabled).length;
					return (
						<div
							key={card.name}
							onClick={() => openCategory(card.name)}
							role="button"
							tabIndex={0}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									openCategory(card.name);
								}
							}}
							className={`group relative overflow-hidden rounded-xl border bg-sidebar text-left shadow-lg duration-200 hover:-translate-y-1 hover:border-accent ${vertical ? "min-h-60" : "min-h-96"}`}
						>
							<Button
								onMouseDown={(event) => event.stopPropagation()}
								onMouseUp={(event) => event.stopPropagation()}
								onClick={(event) => toggleCategoryFavorite(event, card.name)}
								title={card.favorite ? "Remove favorite category" : "Add favorite category"}
								className="absolute right-3 top-3 z-20 h-9 w-9 rounded-full border bg-background/70 p-0 backdrop-blur hover:bg-background"
							>
								<HeartIcon
									className="h-4 w-4"
									style={{ color: card.favorite ? "var(--color-red-400)" : "", fill: card.favorite ? "currentColor" : "none" }}
								/>
							</Button>
							{firstPreview ? (
								<img
									src={`${getImageUrl(firstPreview.path)}?${lastUpdated}`}
									alt=""
									onError={(event) => {
										event.currentTarget.hidden = true;
									}}
									className="absolute inset-0 h-full w-full object-cover opacity-55 blur-[1px] duration-200 group-hover:opacity-70 group-hover:blur-0"
								/>
							) : (
								<div className="absolute inset-0 grid place-items-center bg-background/40">
									<ImageOffIcon className="h-12 w-12 text-muted-foreground" />
								</div>
							)}
							<div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />
							<span className="absolute right-3 top-14 z-10 rounded-md border bg-background/70 px-2 py-1 text-[11px] text-accent">
								{enabledCount} {enabledCount === 1 ? "enabled mod" : "enabled mods"}
							</span>
							<div className={`relative flex h-full flex-col justify-between p-4 ${vertical ? "min-h-60" : "min-h-96"}`}>
								<img
									src={card.icon || "/who.jpg"}
									alt=""
									onError={(event) => {
										event.currentTarget.src = "/who.jpg";
									}}
									className="h-14 w-14 rounded-lg border bg-background object-cover"
								/>
								<div>
									<p className="text-[10px] font-bold uppercase tracking-[0.12em] text-accent">Folder</p>
									<h3 className="line-clamp-2 text-xl font-bold text-foreground">{card.name}</h3>
									<p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
										<FolderOpenIcon className="h-3.5 w-3.5" />
										{card.mods.length} mods
									</p>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

export default MainLocalNavigation;

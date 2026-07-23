import { Category, Mod } from "@/utils/types";
import { getImageUrl, preventContextMenu } from "@/utils/utils";
import {
	CATEGORIES,
	CATEGORY,
	LAST_UPDATED,
	LOCAL_CATEGORY_FAVORITES,
	LOCAL_NAVIGATION_PAGE,
	MOD_LIST,
} from "@/utils/vars";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import CardLocalCats from "./components/CardLocalCats";
interface CategoryCard {
	name: string;
	icon: Category["_sIconUrl"];
	mods: Mod[];
	favorite: boolean;
}
let prevScrollTop = 0;
function MainLocalCats({
	resetNavigationFilters,
	toggleFav,
}: {
	resetNavigationFilters: () => void;
	toggleFav: (enabled: boolean) => void;
}) {
	const initial = useState(true);
	const setCategory = useSetAtom(CATEGORY);
	const setPage = useSetAtom(LOCAL_NAVIGATION_PAGE);
	const [favoriteCategories, setFavoriteCategories] = useAtom(LOCAL_CATEGORY_FAVORITES);
	const categories = useAtomValue(CATEGORIES);
	const mods = useAtomValue(MOD_LIST);
	const lastUpdated = useAtomValue(LAST_UPDATED);
	let vertical = false;
	const categoryCards = useMemo<CategoryCard[]>(() => {
		const favorites = new Set(favoriteCategories);
		const categoryMap = Object.fromEntries(categories.map((category) => [category._sName, category]));
		const FavMods = mods.filter((mod) => mod.tags?.includes("fav"));
		const grouped = {} as Record<string, Mod[]>;
		for (const mod of mods) {
			const categoryName = mod.parent;
			if (!grouped[categoryName]) {
				grouped[categoryName] = [];
			}
			grouped[categoryName].push(mod);
		}
		return [
			...(FavMods.length > 0
				? [
						{
							name: "Favorites",
							icon: "heart",
							mods: FavMods,
							favorite: true,
						},
					]
				: []),
			...Object.entries(grouped)
				.map(([categoryName, mods]) => ({
					name: categoryName,
					icon: categoryMap[categoryName]?._sIconUrl || "folder",
					mods: mods,
					favorite: favorites.has(categoryName),
				}))
				.sort((a, b) => {
					if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
					return a.name.localeCompare(b.name);
				}),
		];
	}, [categories, favoriteCategories, mods]);
	const openCategory = (categoryName: string, isFirst = false) => {
		resetNavigationFilters();
		if (isFirst) {
			toggleFav(true);
		} else {
			setCategory(new Set([categoryName]));
		}
		setPage("mods");
	};

	const transitionConfig = useCallback(
		(index: number) => ({
			duration: 0.3,
			ease: "easeOut" as const,
			delay: initial ? 0.05 * index : 0,
		}),
		[initial]
	);

	const toggleCategoryFavorite = (event: React.MouseEvent, categoryName: string) => {
		event.preventDefault();
		event.stopPropagation();
		setFavoriteCategories((previous) =>
			previous.includes(categoryName) ? previous.filter((name) => name !== categoryName) : [...previous, categoryName]
		);
	};
	return (
		<div
			className={`h-full w-full overflow-y-auto pb-6 ${vertical ? "px-3" : "px-5"}`}
			onLoad={(e) => {
				prevScrollTop = Math.max(1, prevScrollTop);
				e.currentTarget.scrollTop = prevScrollTop;
			}}
			onScroll={(e) => {
				e.currentTarget.scrollTop = Math.max(1, e.currentTarget.scrollTop);
				prevScrollTop = e.currentTarget.scrollTop;
			}}
		>
			<div className="top-0 z-20 border-b bg-background/95 px-1 py-4 backdrop-blur">
				<h2 className="text-3xl text-accent">Browse by category</h2>
				<p className="text-xs text-muted-foreground">
					{mods.length} total mods · Open a category folder to view its mods.
				</p>
			</div>
			<AnimatePresence mode="popLayout" initial={prevScrollTop === 0}>
				<div className="min-h-fit card-grid card-grid-cats grid justify-center w-full py-4">
					{categoryCards.map((card, index) => {
						const previews = card.mods
							.map((x) => ({
								src: getImageUrl(x.path) + `?${lastUpdated}`,
								crop: x.crop,
							}))
							.filter((x) => x.src);
						const enabledCount = card.mods.filter((mod) => mod.enabled).length;
						return (
							<motion.div
								key={card.name}
								layout
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								transition={transitionConfig(index)}
								onMouseUp={() => openCategory(card.name)}
								onContextMenu={preventContextMenu}
							>
								<CardLocalCats
									{...{
										card,
										openCategory,
										enabledCount,
										previews,
										index,
										toggleCategoryFavorite,
										initial: prevScrollTop === 0,
									}}
								/>
							</motion.div>
						);
					})}
				</div>
			</AnimatePresence>
		</div>
	);
}

export default MainLocalCats;

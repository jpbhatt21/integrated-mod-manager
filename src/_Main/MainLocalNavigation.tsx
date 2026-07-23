import { Button } from "@/components/ui/button";
import { CATEGORY, FILTER, LOCAL_NAVIGATION_MODE, LOCAL_NAVIGATION_PAGE, SEARCH, SORT } from "@/utils/vars";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ArrowLeftIcon } from "lucide-react";
import { useEffect } from "react";
import MainLocal from "./MainLocal";
import MainLocalCats from "./MainLocalCats";
import { AnimatePresence, motion } from "motion/react";

function MainLocalNavigation() {
	const mode = useAtomValue(LOCAL_NAVIGATION_MODE);
	const vertical = mode === "vertical";
	const [page, setPage] = useAtom(LOCAL_NAVIGATION_PAGE);
	const selectedCategories = useAtomValue(CATEGORY);
	const [search, setSearch] = useAtom(SEARCH);
	const setCategory = useSetAtom(CATEGORY);
	const setFilter = useSetAtom(FILTER);
	const setSort = useSetAtom(SORT);

	useEffect(() => {
		if (mode !== "classic" && selectedCategories.size > 0) setPage("mods");
	}, [mode, selectedCategories, setPage]);
	useEffect(() => {
		if (!search.trim()) {
			const back = (e: KeyboardEvent) => {
				if (e.key === "Escape" && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
					resetNavigationFilters();
					setPage("categories");
				}
			};
			window.addEventListener("keydown", back);
			return () => {
				window.removeEventListener("keydown", back);
			};
		}
		return () => {};
	}, [mode, search]);

	if (mode === "classic") return <MainLocal />;

	const resetNavigationFilters = () => {
		setCategory(new Set());
		setFilter((previous) => ({
			...previous,
			tag: { ...(previous.tag as Record<string, string>), fav: "any" },
		}));
		setSort("default");
	};

	const toggleFav = (enabled: boolean) => {
		setFilter((previous) => ({
			...previous,
			tag: { ...(previous.tag as Record<string, string>), fav: enabled ? "has" : "any" },
		}));
	};

	return (
		<div className="flex relative h-full w-full flex-col overflow-hidden">
			<AnimatePresence initial={false}>
				{page === "mods" || search.trim() ? (
					<motion.div
						key="mods"
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.95 }}
						transition={{
							duration: 1,
							type: "spring",
						}}
						className="flex absolute h-full w-full flex-col gap-0 overflow-hidden"
					>
						<div className="flex w-full items-center px-2 pb-1 -mb-2">
							<Button
								variant="ghost"
								className="h-9 gap-2 hover:text-background"
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
							<MainLocal compact={vertical} isCategory={true} />
						</div>
					</motion.div>
				) : (
					<motion.div
						key="categories"
						initial={{ opacity: 0, scale: 1.05 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 1.05 }}
						transition={{
							duration: 1,
							type: "spring",
						}}
						className="flex absolute h-full w-full flex-col overflow-hidden"
					>
						<MainLocalCats resetNavigationFilters={resetNavigationFilters} toggleFav={toggleFav} />
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

export default MainLocalNavigation;

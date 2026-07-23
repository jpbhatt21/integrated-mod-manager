import { Button } from "@/components/ui/button";
import { Mod } from "@/utils/types";
import { handleImageError } from "@/utils/utils";
import { HeartIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { useEffect, useState } from "react";

const CardLocalCats = React.memo(
	({
		card,
		openCategory,
		toggleCategoryFavorite,
		enabledCount,
		previews,
		index,
		initial,
	}: {
		card: {
			name: string;
			icon: string;
			mods: Mod[];
			favorite: boolean;
		};
		openCategory: (categoryName: string, isFirst?: boolean) => void;
		toggleCategoryFavorite: (event: React.MouseEvent<HTMLButtonElement>, categoryName: string) => void;
		enabledCount: number;
		previews: {
			src: string;
			crop:
				| {
						x?: number;
						y?: number;
						scale?: number;
				  }
				| undefined;
		}[];
		index: number;
		initial: boolean;
	}) => {
		const [previewIndex, setPreviewIndex] = useState(0);
		useEffect(() => {
			if (previews.length > 1) {
				let timeout: number | undefined;
				const timeoutFunction = () => {
					setPreviewIndex((prevIndex) => (prevIndex + 1) % previews.length);
					timeout = setTimeout(timeoutFunction, 7000 + index * 500 + Math.floor(Math.random() * 500));
				};
				timeout = setTimeout(timeoutFunction, 7000 + index * 500 + Math.floor(Math.random() * 500));
				return () => clearTimeout(timeout);
			}
			return () => {};
		}, [previews]);
		const preview = previews[previewIndex];
		return (
			<div
				key={card.name}
				onClick={() => openCategory(card.name, index === 0 )}
				role="button"
				tabIndex={0}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						openCategory(card.name, index === 0);
					}
				}}
				className={`card-generic card-cats group relative`}
			>
				<AnimatePresence initial={initial}>
					<motion.div
						key={previewIndex + preview?.src}
						initial={{ opacity: 0, scale: 1.3, filter: "blur(8px)" }}
						animate={{ opacity: 1, scale: 1.1, filter: "blur(0px)" }}
						exit={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
						transition={{ duration: 1, type: "spring", delay: 0.1 * index }}
						className="absolute w-full scale-110 group-hover:scale-100 fadein h-full flex items-center justify-center duration-200 rounded-t-lg data-gi:rounded-none pointer-events-none overflow-hidden"
					>
						<img
							style={{
								left: `calc(var(--card-cat-scale) * ${-(preview?.crop?.x || 0)}px)`,
								top: `calc(var(--card-cat-scale) * ${-(preview?.crop?.y || 0)}px)`,
								scale: preview?.crop?.scale || 1,
								minWidth: "fit-content",
								minHeight: "100%",
							}}
							className="w-full h-full relative object-contain object-center"
							src={preview?.src || ""}
							onError={(e) => {
								handleImageError(e);
								e.currentTarget.style.top= "calc(var(--card-cat-scale) * -10px)";
							}}
							onLoad={(e) => {
								const img = e.currentTarget;
								const aspect = img.naturalWidth / img.naturalHeight;
								if (aspect > 1) {
									img.style.minWidth = "fit-content";
									img.style.minHeight = "100%";
								} else {
									img.style.minWidth = "14rem";
									img.style.minHeight = "fit-content";
								}
							}}
						/>
					</motion.div>
				</AnimatePresence>
				<div className="absolute inset-0 bg-linear-to-t from-background via-background/35 to-transparent" />
				<div className="absolute top-0 left-0 w-full gap-2 p-1 flex justify-between">
					<div className="backdrop-blur-md h-10 border flex items-center gap-1 text-xs rounded-lg button-like px-2 text-accent bg-background/50">
						{enabledCount}/{card.mods.length} enabled
					</div>
					{card.icon != "heart" && (
						<Button
							onMouseDown={(event) => event.stopPropagation()}
							onMouseUp={(event) => event.stopPropagation()}
							onClick={(event) => toggleCategoryFavorite(event, card.name)}
							title={card.favorite ? "Remove favorite category" : "Add favorite category"}
							className="shrink-0 w-10 h-10 rounded-lg border button-like pt-0 pl-0 pb-0 pr-0 hover:bg-background  bg-background/50 backdrop-blur-md"
						>
							<HeartIcon
								className="min-h-5 min-w-5"
								style={{
									color: card.favorite ? "var(--color-red-400)" : "",
									fill: card.favorite ? "currentColor" : "none",
								}}
							/>
						</Button>
					)}
				</div>
				<div className="absolute bottom-0 left-0 w-full gap-2 p-1.5 flex items-center">
					{card.icon == "heart" ? (
						<div
							className="shrink-0 w-12 h-12 flex items-center justify-center rounded-lg border bg-background/50 backdrop-blur-md"
						>
							<HeartIcon
								className="min-h-6 min-w-6"
								style={{
									color: card.favorite ? "var(--color-red-400)" : "",
									fill: card.favorite ? "currentColor" : "none",
								}}
							/>
						</div>
					) : (
						<img
							src={card.icon || "/who.jpg"}
							alt=""
							onError={(event) => {
								event.currentTarget.src = "/who.jpg";
							}}
							className="h-12 aspect-square rounded-lg border bg-background/50 backdrop-blur-md object-cover"
						/>
					)}

					<h3 className="font-bold text-xl text-foreground">{card.name}</h3>
				</div>
			</div>
		);
	}
);

CardLocalCats.displayName = "CardLocalCats";

export default CardLocalCats;

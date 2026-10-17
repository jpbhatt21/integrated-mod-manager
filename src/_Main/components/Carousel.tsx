import { MessageSquare, ThumbsUp } from "lucide-react";
import { Carousel as CarouselCN, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Input } from "@/components/ui/input";
import Autoplay from "embla-carousel-autoplay";
import { useEffect, useState } from "react";
// import { OnlineMod } from "@/utils/types";
import type { EmblaCarouselType } from "embla-carousel";
import Blur from "./Filter";
import { OnlineMod } from "@/utils/types";
import { useAtomValue } from "jotai";
import { TEXT_DATA } from "@/utils/vars";

function Carousel({
	data,
	onModClick,
	blur = true,
}: {
	data?: OnlineMod[];
	onModClick?: (e: any, data: OnlineMod) => void;
	blur?: boolean;
}) {
	const [api, setApi] = useState<EmblaCarouselType | undefined>();
	const [current, setCurrent] = useState(0);
	const textData = useAtomValue(TEXT_DATA);
	useEffect(() => {
		if (!api) return;
		const onSelect = () => {
			setCurrent(api.selectedScrollSnap());
		};
		api.on("select", onSelect);
		return () => {
			api.off("select", onSelect);
		};
	}, [api]);

	return (
		<>
			<CarouselCN
				setApi={setApi}
				opts={{ loop: true }}
				plugins={[Autoplay({ delay: 5000 })]}
				className="aspect-video max-w-175 xl:max-w-3xl duration-300 transition-[max-width] overflow-hidden rounded-lg"
			>
				<CarouselContent>
					{data?.map((item, index) => (
						<CarouselItem key={index}>
							<div
								onClick={(e) => {
									if (e.target != e.currentTarget) return;
									if (onModClick) {
										onModClick(e, item);
									} else {
									}
								}}
								className=" aspect-video flex flex-col items-center justify-between overflow-hidden border rounded-lg"
								style={{
									backgroundImage: `url(${item._sImageUrl})`,
									backgroundSize: "cover",
									backgroundPosition: "center",
								}}
							>
								<div className="text-accent -mb-18 z-10 flex justify-between w-full h-16 overflow-hidden rounded-lg pointer-events-none">
									<label className="bg-background/50 backdrop-blur-md h-fit brightness-100 px-4 py-2 text-lg font-bold rounded-tl-lg rounded-br-lg">
										 {textData.Others.bestOf.replaceAll("<date/>", textData.Others[(item._sPeriod || "alltime")])}
									</label>
									<label className="bg-background/50 py-2.5 px-4 rounded-bl-lg rounded-tr-lg backdrop-blur-md h-fit brightness-100 ">
										by {item._aSubmitter._sName}
									</label>
								</div>
								<Blur blur={item._sInitialVisibility == "hide" && blur} />
								<div className="h-14 bg-background/50 backdrop-blur-md -mt-14 flex items-center justify-between w-full px-2 overflow-hidden rounded-b-lg pointer-events-none">
									<Input
										className="w-full text-accent  border-0 rounded-none select-none focus-within:select-auto overflow-hidden max-h-14 focus-visible:ring-0 focus-within:border-0   text-ellipsis"
										value={item._sName}
										style={{ backgroundColor: "#fff0", fontSize: "1.5rem" }}
									/>
									<div className="text-accent flex items-center justify-between w-32 h-10">
										<div className="flex items-center justify-center w-1/2 h-10 gap-1 text-sm">
											<ThumbsUp />
											{item._nLikeCount}
										</div>
										<div className="flex items-center justify-center w-1/2 h-10 gap-1 text-sm">
											<MessageSquare />
											{item._nPostCount}
										</div>
									</div>
								</div>
							</div>
						</CarouselItem>
					))}
				</CarouselContent>
			</CarouselCN>
			<div className="flex items-center justify-center w-full h-8 gap-1 rounded-lg">
				{data?.map((_, index) => (
					<div
						className={
							"h-1/3 aspect-square rounded-full border duration-200 " +
							(index == current ? "bg-accent bgaccent   border-accent" : " hover:bg-border")
						}
						onClick={() => {
							if (api) {
								api.scrollTo(index);
							}
						}}
					></div>
				))}
			</div>
		</>
	);
}
export default Carousel;

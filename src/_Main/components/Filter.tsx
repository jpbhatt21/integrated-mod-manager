import { Button } from "@/components/ui/button";
import { TEXT_DATA } from "@/utils/vars";
import { useAtomValue } from "jotai";
import { EyeOff } from "lucide-react";
function Blur({  blur }: { blur: boolean }) {
	const textData = useAtomValue(TEXT_DATA);
	return (
		<div
			className="flex items-center justify-center object-cover w-full h-full duration-200 bg-center pointer-events-none rounded-lg"
			style={{
				background: blur ? "#0008" : "#0000",
				backdropFilter: blur ? "blur(12px)" : "blur(0px)",
			}}>
			{blur && (
				<Button
					className="bg-background/50 duration-200 pointer-events-auto"
					onClick={(e) => {
						e.currentTarget.style.opacity = "0";
						e.currentTarget.style.pointerEvents = "none";
						let parent = e.currentTarget.parentElement;
						if (parent) {
							parent.style.background = "#0000";
							parent.style.backdropFilter = "blur(0px)";
						}
					}}>
					<EyeOff /> {textData.Show}
				</Button>
			)}
		</div>
	);
}
export default Blur;
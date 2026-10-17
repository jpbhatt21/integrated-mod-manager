import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TEXT_DATA } from "@/utils/vars";
import { useAtomValue } from "jotai";

let timer: ReturnType<typeof setTimeout>;
function Credits() {
	const textData = useAtomValue(TEXT_DATA)
	return (
		<AlertDialog>
			<AlertDialogTrigger>
				<Button
					className=" max-h-7 text-sm"
					onClick={() => {
						if (timer) clearTimeout(timer);
						timer = setTimeout(() => {
							(document.getElementById("cancel-alert") as HTMLButtonElement)?.click();
						}, 55000);
					}}
				>
					{textData.Credits.creds}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent
				className="min-w-full border-0 h-full max-h-[calc(100%-2rem)] mt-4 overflow-hidden"
				onClick={(e) => {
					(e.currentTarget.firstChild as HTMLButtonElement)?.click();
					if (timer) clearTimeout(timer);
				}}
			>
				<AlertDialogCancel id="cancel-alert" className="absolute top-4 right-4 z-10 bg-transparent " />
				<style>{`
								@keyframes crawl {
									0% { transform: rotateX(45deg) translateY(1%); margin-top:0%; }
									100% { transform: rotateX(45deg) translateY(-200%); margin-top:-50%; }
								}
							`}</style>
				<div className="absolute inset-0 flex justify-center overflow-hidden" style={{ perspective: "25rem" }}>
					<div
						className="absolute w-full max-w-2xl text-center text-muted-foreground top-full"
						style={{
							animation: "crawl 100s linear",
							transformOrigin: "50% 0%",
						}}
					>
						<img src="/IMMDecor.png" alt="IMM Logo" className="mx-auto w-64 mb-8 opacity-80" />
{/* 
						<div className="text-foreground text-2xl">Integrated</div>
						<div className=" text-accent textaccent text-lg">Mod Manager</div> */}

						<div className="text-2xl mb-16 opacity-80">{textData.Credits.long}</div>

						<div className="text-3xl font-bold textaccent text-accent mb-2">{textData.Credits.creator}</div>
						<div className="text-xl mb-6">YourBadLuck</div>

						<div className="text-3xl font-bold textaccent text-accent mb-2">{textData.Credits.contri}</div>
						<div className="text-xl mb-2">Antonzlo</div>
						<div className="text-xl mb-2">EgoMaw</div>
						<div className="text-xl mb-8">EvilNick2</div>

						<div className="text-3xl font-bold textaccent text-accent mb-2">{textData.Credits.translation}</div>
						<div className="text-xl mb-2">Antonzlo ( {textData.Languages.ru} )</div>
						<div className="text-xl mb-8">118ununoctium ( {textData.Languages.cn} )</div>

						<div className="text-3xl font-bold textaccent text-accent mb-2">{textData.Credits.EMERG}</div>
						<div className="text-xl mb-8">{textData.Credits.paimon}</div>

						<div className="text-3xl font-bold textaccent text-accent mb-2">{textData.Credits.OSM}</div>
						<div className="text-xl mb-8">{textData.Credits.zhongli}</div>

						<div className="text-3xl font-bold textaccent text-accent mb-2">{textData.Credits.ARTI}</div>
						<div className="text-xl mb-2">{textData.Credits.flatDef}</div>
						<div className="text-lg mb-8 opacity-70">{textData.Credits.roll}</div>

						<div className="text-3xl font-bold textaccent text-accent mb-2">{textData.Credits.BGB}</div>
						<div className="text-xl mb-8">{textData.Credits.proxy}</div>

						<div className="text-3xl font-bold textaccent text-accent mb-2">{textData.Credits.COMS}</div>
						<div className="text-xl mb-8">{textData.Credits.venus}</div>

						<div className="text-3xl font-bold textaccent text-accent mb-2">{textData.Credits.ECHO}</div>
						<div className="text-xl mb-2">{textData.Credits.rover}</div>
						<div className="text-lg mb-8 opacity-70">{textData.Credits.no5cost}</div>

						<div className="text-3xl font-bold textaccent text-accent mb-2">{textData.Credits.MVP}</div>
						<div className="text-xl mb-8">{textData.Credits.modders}</div>

						<div className="text-3xl font-bold textaccent text-accent mb-2">{textData.Credits.SPT}</div>
						<div className="text-xl mb-2">XLXZ (XX Mod Manager)</div>
						<div className="text-xl mb-2">Agulag (No Reload Mod Manager)</div>
						<div className="text-xl mb-2">{textData.Credits.community}</div>
						<div className="text-xl mb-2">{textData.Credits.testers}</div>
						<div className="text-xl mb-2">{textData.Credits.user}</div>

						<div className="text-4xl font-bold mt-16 textaccent text-accent mb-8">{textData.Credits.may}</div>
						<div className="text-xl mt-12 mb-2">{textData.Credits.thanks.replace("<imm/>","").trim()}</div>
						<div className="text-foreground text-2xl">Integrated</div>
						<div className=" text-accent textaccent text-lg">Mod Manager</div>

					</div>
				</div>
			</AlertDialogContent>
		</AlertDialog>
	);
}

export default Credits;

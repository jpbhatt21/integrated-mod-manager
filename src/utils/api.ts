// API client for communicating with Flask backend

import { VERSION } from "./consts";
import { saveConfigs } from "./filesys";
import { Category } from "./types";
import { sanitizeFileName } from "./utils";
import { SETTINGS, store } from "./vars";
import GAME_DATA from "@/gameData.json";

const API_BASE_URL = "https://gamebanana.com/apiv11/";
const HEALTH_CHECK = "https://health.wwmm.bhatt.jp/health";
class ApiClient {
	private GAME = "WW";
	private CLIENT = "";
	setClient(client: string) {
		this.CLIENT = client;
	}
	setGame(game: keyof typeof GAME_DATA) {
		if (GAME_DATA[game]) {
			this.GAME = game;
			this.id = GAME_DATA[game].id;
			this.categoryList = GAME_DATA[game].categoryList as Category[];
			this.generic = GAME_DATA[game].generic;
			return;
		}
		this.GAME = game;
	}
	private id: Record<string, string> = {
		categories: "29524",
		game: "20357",
	};
	categoryList: Category[] = [
		{
			_idRow: 30257,
			_sName: "Aalto",
			_nItemCount: 8,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30257",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c4ff33f3b.png",
		},
		{
			_idRow: 39143,
			_sName: "Augusta",
			_nItemCount: 44,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/39143",
			_sIconUrl: "",
		},
		{
			_idRow: 30251,
			_sName: "Baizhi",
			_nItemCount: 43,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30251",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c39f41dda.png",
		},
		{
			_idRow: 35523,
			_sName: "Brant",
			_nItemCount: 14,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/35523",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/67c981a895579.png",
		},
		{
			_idRow: 30262,
			_sName: "Calcharo",
			_nItemCount: 17,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30262",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c5f44ca4e.png",
		},
		{
			_idRow: 33179,
			_sName: "Camellya",
			_nItemCount: 103,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/33179",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/675b7f303af84.png",
		},
		{
			_idRow: 36003,
			_sName: "Cantarella",
			_nItemCount: 65,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/36003",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6812a36c23457.png",
		},
		{
			_idRow: 34264,
			_sName: "Carlotta",
			_nItemCount: 93,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/34264",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6812a3cf60524.png",
		},
		{
			_idRow: 37392,
			_sName: "Cartethyia",
			_nItemCount: 67,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/37392",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/686f2a0b0506c.png",
		},
		{
			_idRow: 30265,
			_sName: "Changli",
			_nItemCount: 130,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30265",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c68095b05.png",
		},
		{
			_idRow: 30247,
			_sName: "Chixia",
			_nItemCount: 30,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30247",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c25a55aad.png",
		},
		{
			_idRow: 36990,
			_sName: "Ciaccona",
			_nItemCount: 41,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/36990",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/686f2a130c551.png",
		},
		{
			_idRow: 30255,
			_sName: "Danjin",
			_nItemCount: 29,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30255",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c49eef2b5.png",
		},
		{
			_idRow: 30253,
			_sName: "Encore",
			_nItemCount: 25,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30253",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c41aafe7c.png",
		},
		{
			_idRow: 39624,
			_sName: "Iuno",
			_nItemCount: 35,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/39624",
			_sIconUrl: "",
		},
		{
			_idRow: 30263,
			_sName: "Jianxin",
			_nItemCount: 34,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30263",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c6300cb95.png",
		},
		{
			_idRow: 30264,
			_sName: "Jinhsi",
			_nItemCount: 95,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30264",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c65ae3201.png",
		},
		{
			_idRow: 30256,
			_sName: "Jiyan",
			_nItemCount: 21,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30256",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c4cec9dfe.png",
		},
		{
			_idRow: 30259,
			_sName: "Lingyang",
			_nItemCount: 10,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30259",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c56786bfb.png",
		},
		{
			_idRow: 33764,
			_sName: "Lumi",
			_nItemCount: 16,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/33764",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/675b1120b010b.png",
		},
		{
			_idRow: 37891,
			_sName: "Lupa",
			_nItemCount: 42,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/37891",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/686f2a1a391f8.png",
		},
		{
			_idRow: 30258,
			_sName: "Mortefi",
			_nItemCount: 14,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30258",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c52684f89.png",
		},
		{
			_idRow: 35119,
			_sName: "Phoebe",
			_nItemCount: 71,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/35119",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6812a40cb85a4.png",
		},
		{
			_idRow: 38371,
			_sName: "Phrolova",
			_nItemCount: 44,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/38371",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/68ab24ab15f8f.png",
		},
		{
			_idRow: 34733,
			_sName: "Roccia",
			_nItemCount: 20,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/34733",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6812a44645b98.png",
		},
		{
			_idRow: 30250,
			_sName: "Rover Female",
			_nItemCount: 106,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30250",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c35cd412e.png",
		},
		{
			_idRow: 30249,
			_sName: "Rover Male",
			_nItemCount: 75,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30249",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c30d33704.png",
		},
		{
			_idRow: 30252,
			_sName: "Sanhua",
			_nItemCount: 50,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30252",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c3d32a078.png",
		},
		{
			_idRow: 32220,
			_sName: "Shorekeeper",
			_nItemCount: 102,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/32220",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/66f8c47b49ee8.png",
		},
		{
			_idRow: 30254,
			_sName: "Taoqi",
			_nItemCount: 26,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30254",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c451a74aa.png",
		},
		{
			_idRow: 30248,
			_sName: "Verina",
			_nItemCount: 32,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30248",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c2db4c218.png",
		},
		{
			_idRow: 30471,
			_sName: "Xiangli Yao",
			_nItemCount: 23,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30471",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/66bddde6d44ed.png",
		},
		{
			_idRow: 30246,
			_sName: "Yangyang",
			_nItemCount: 36,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30246",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c230d99e1.png",
		},
		{
			_idRow: 30261,
			_sName: "Yinlin",
			_nItemCount: 115,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30261",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c5b7aea39.png",
		},
		{
			_idRow: 33791,
			_sName: "Youhu",
			_nItemCount: 6,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/33791",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6812a47de960d.png",
		},
		{
			_idRow: 30260,
			_sName: "Yuanwu",
			_nItemCount: 11,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30260",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6683c591329e5.png",
		},
		{
			_idRow: 36665,
			_sName: "Zani",
			_nItemCount: 45,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/36665",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6812a2f8ddacc.png",
		},
		{
			_idRow: 30472,
			_sName: "Zhezhi",
			_nItemCount: 48,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/30472",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/66bdde0a65151.png",
		},
		{
			_idRow: 31838,
			_sName: "NPCs & Entities",
			_nItemCount: 12,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/31838",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/66e0d90771ac5.png",
		},
		{
			_idRow: 29493,
			_sName: "Other",
			_nItemCount: 75,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/29493",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6692c90cba314.png",
			_special: true,
		},
		{
			_idRow: 29496,
			_sName: "UI",
			_nItemCount: 55,
			_nCategoryCount: 0,
			_sUrl: "https://gamebanana.com/mods/cats/29496",
			_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6692c913ddf00.png",
			_special: true,
		},
	];
	generic: Record<string, Category[]> = {
		categories: [
			{
				_idRow: 31838,
				_sName: "NPCs & Entities",
				_nItemCount: 12,
				_nCategoryCount: 0,
				_sUrl: "https://gamebanana.com/mods/cats/31838",
				_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/66e0d90771ac5.png",
			},
			{
				_idRow: 29493,
				_sName: "Other",
				_nItemCount: 75,
				_nCategoryCount: 0,
				_sUrl: "https://gamebanana.com/mods/cats/29493",
				_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6692c90cba314.png",
				_special: true,
			},
			{
				_idRow: 29496,
				_sName: "UI",
				_nItemCount: 55,
				_nCategoryCount: 0,
				_sUrl: "https://gamebanana.com/mods/cats/29496",
				_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6692c913ddf00.png",
				_special: true,
			},
		],
		types: [
			{
				_idRow: 29524,
				_sName: "Skins",
				_nItemCount: 1483,
				_nCategoryCount: 34,
				_sUrl: "https://gamebanana.com/mods/cats/29524",
				_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6654b6596ba11.png",
			},
			{
				_idRow: 29496,
				_sName: "UI",
				_nItemCount: 57,
				_nCategoryCount: 0,
				_sUrl: "https://gamebanana.com/mods/cats/29496",
				_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6692c913ddf00.png",
			},
			{
				_idRow: 29493,
				_sName: "Other",
				_nItemCount: 75,
				_nCategoryCount: 0,
				_sUrl: "https://gamebanana.com/mods/cats/29493",
				_sIconUrl: "https://images.gamebanana.com/img/ico/ModCategory/6692c90cba314.png",
			},
		],
	};
	constructor() {
		return this;
	}

	async makeRequest(endpoint: string, options: RequestInit = {}) {
		const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

		if (!response.ok) {
			throw new Error(`API request failed: ${response.statusText}`);
		}

		return response.json();
	}

	async categories() {
		this.healthCheck();
		try {
			const fetchWithRetry = async (timeouts: number[] = [2000, 5000]): Promise<any> => {
				for (let i = 0; i < timeouts.length; i++) {
					try {
						const controller = new AbortController();
						const timeoutId = setTimeout(() => controller.abort(), timeouts[i]);
						const response = await this.makeRequest(
							`Mod/Categories?_idCategoryRow=${this.id.categories}&_sSort=a_to_z&_bShowEmpty=true`,
							{ signal: controller.signal }
						);
						clearTimeout(timeoutId);
						if (!response) {
							throw new Error(`HTTP ${response.status}`);
						}
						return await response;
					} catch (error) {
						if (i === timeouts.length - 1) {
							throw error;
						}
					}
				}
			};
			const response = await fetchWithRetry();
			this.categoryList = [
				...response
					.filter((x: any) => x._idRow !== 31838)
					.map((cat: any) => ({
						...cat,
						_sIconUrl: cat._sIconUrl || "/who.jpg",
						_sName: sanitizeFileName(cat._sName),
					})),
				...this.generic.categories,
			];
			return this.categoryList;
		} catch (error) {
			return [];
		}
	}

	home({ sort = "default", page = 1, type = "" }: { sort?: string; page?: number; type?: string }) {
		return `${API_BASE_URL}Game/${this.id.game}/Subfeed?${
			type ? `_csvModelInclusions=${type}&` : ""
		}_sSort=${sort}&_nPage=${page}`;
	}

	category({ cat = "", sort = "default", page = 1 }) {
		return `${API_BASE_URL}Mod/Index?_nPerpage=15&_aFilters%5BGeneric_Category%5D=${(
			(cat.split("/").length > 1
				? this.categoryList.find((x) => x._sName == cat.split("/")[1])?._idRow
				: this.generic.types.find((x) => x._sName == cat.split("/")[0])?._idRow) || 0
		).toString()}&_sSort=${sort}&_nPage=${page}`;
	}

	banner() {
		return `${API_BASE_URL}Game/${this.id.game}/TopSubs`;
	}

	async mod(mod = "Mod/0", signal?: AbortSignal) {
		try {
			const response = await this.makeRequest(`${mod}/ProfilePage`, signal && { signal });
			return response;
		} catch (error) {
			throw error;
		}
	}

	async updates(mod = "Mod/0", signal?: AbortSignal) {
		try {
			const response = await this.makeRequest(`${mod}/Updates?_nPage=1&_nPerpage=5`, signal && { signal });
			return response;
		} catch (error) {
			throw error;
		}
	}
	async comments(mod = "Mod/0", page = 1, signal?: AbortSignal) {
		try {
			const response = await this.makeRequest(
				`${mod}/Posts?_nPage=${page}&_nPerpage=15&_sSort=popular`,
				signal && { signal }
			);
			return response;
		} catch (error) {
			throw error;
		}
	}
	async nestedcomments(postId = "0", signal?: AbortSignal) {
		try {
			const response = await this.makeRequest(`Post/${postId}/Posts?_nPage=1&_nPerpage=15`, signal && { signal });
			return response;
		} catch (error) {
			throw error;
		}
	}
	search({ term = "", page = 1, type = "" }) {
		return `${API_BASE_URL}Util/Search/Results?_sModelName=${type}&_sOrder=best_match&_idGameRow=${
			this.id.game
		}&_sSearchString=${encodeURIComponent(term)}&_nPage=${page}`;
	}

	async healthCheck() {
		const base = `${HEALTH_CHECK}/${VERSION || "2.0.1"}/${this.GAME || "WW"}`;
		try {
			if (this.CLIENT) fetch(`${base}/${this.CLIENT}`);
			else {
				fetch(`${base}/_${Date.now()}`)
					.then((res) => res.json())
					.then((data) => {
						if (data.client) {
							this.CLIENT = data.client;
							store.set(SETTINGS, (prev) => ({ ...prev, global: { ...prev.global, clientDate: data.client } }));
							saveConfigs();
						}
					});
			}
		} catch (error) {}
	}
}
export const apiClient = new ApiClient();

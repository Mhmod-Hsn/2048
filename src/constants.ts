export const GRID_SIZE = 4;
export const WIN_TILE = 2048;

export const TILE_COLORS: Record<number, string> = {
	0: "bg-[#cdc1b4]",
	2: "bg-[#eee4da] text-[#776e65]",
	4: "bg-[#ede0c8] text-[#776e65]",
	8: "bg-[#f2b179] text-white",
	16: "bg-[#f59563] text-white",
	32: "bg-[#f67c5f] text-white",
	64: "bg-[#f65e3b] text-white",
	128: "bg-[#edcf72] text-white",
	256: "bg-[#edcc61] text-white",
	512: "bg-[#edc850] text-white",
	1024: "bg-[#edc53f] text-white",
	2048: "bg-[#edc22e] text-white shadow-[0_0_30px_10px_rgba(243,215,116,0.5)]",
	4096: "bg-[#edc11d] text-white shadow-[0_0_30px_10px_rgba(243,215,116,0.5)]",
	8192: "bg-[#edc00c] text-white shadow-[0_0_30px_10px_rgba(243,215,116,0.5)]",
	16384: "bg-[#edc00b] text-white shadow-[0_0_30px_10px_rgba(243,215,116,0.5)]",
	32768: "bg-[#edc009] text-white shadow-[0_0_30px_10px_rgba(243,215,116,0.5)]",
	65536: "bg-[#edc008] text-white shadow-[0_0_30px_10px_rgba(243,215,116,0.5)]",
};

export const getTileColor = (val: number): string => {
	if (val >= 65536) return TILE_COLORS[65536];
	return TILE_COLORS[val] || TILE_COLORS[0];
};

export const getTileFontSize = (val: number): string => {
	if (val >= 10000) return "text-[clamp(1.1rem,3.4vmin,3.4rem)]";
	if (val >= 1000) return "text-[clamp(1.35rem,4.4vmin,4.5rem)]";
	if (val >= 100) return "text-[clamp(1.6rem,5.6vmin,5.6rem)]";
	return "text-[clamp(2.25rem,7.8vmin,8rem)]";
};

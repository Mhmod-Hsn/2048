export interface Tile {
	id: number;
	r: number;
	c: number;
	value: number;
	isNew: boolean;
	isMerged: boolean;
	isDestroying: boolean;
}

export type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

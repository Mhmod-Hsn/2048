import { GRID_SIZE } from "./constants";
import type { Direction, Tile } from "./types";

let nextId = 1;

export const addRandomTile = (currentTiles: Tile[]): Tile[] => {
	const grid: (Tile | null)[][] = Array(GRID_SIZE)
		.fill(null)
		.map(() => Array(GRID_SIZE).fill(null));
	currentTiles.forEach((t) => {
		if (!t.isDestroying) grid[t.r][t.c] = t;
	});

	const emptyCells: { r: number; c: number }[] = [];
	for (let r = 0; r < GRID_SIZE; r++) {
		for (let c = 0; c < GRID_SIZE; c++) {
			if (!grid[r][c]) emptyCells.push({ r, c });
		}
	}

	if (emptyCells.length === 0) return currentTiles;

	const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
	const newTile: Tile = {
		id: nextId++,
		r: randomCell.r,
		c: randomCell.c,
		value: Math.random() < 0.9 ? 2 : 4,
		isNew: true,
		isMerged: false,
		isDestroying: false,
	};

	return [...currentTiles, newTile];
};

export const checkGameOver = (tiles: Tile[]): boolean => {
	if (tiles.filter((t) => !t.isDestroying).length < GRID_SIZE * GRID_SIZE)
		return false;

	const grid: (Tile | null)[][] = Array(GRID_SIZE)
		.fill(null)
		.map(() => Array(GRID_SIZE).fill(null));
	tiles.forEach((t) => {
		if (!t.isDestroying) grid[t.r][t.c] = t;
	});

	for (let r = 0; r < GRID_SIZE; r++) {
		for (let c = 0; c < GRID_SIZE; c++) {
			const val = grid[r][c]?.value;
			if (val === undefined) continue;
			if (r < GRID_SIZE - 1 && grid[r + 1][c]?.value === val) return false;
			if (c < GRID_SIZE - 1 && grid[r][c + 1]?.value === val) return false;
		}
	}
	return true;
};

export const getVector = (dir: Direction): { r: number; c: number } => {
	switch (dir) {
		case "UP":
			return { r: -1, c: 0 };
		case "DOWN":
			return { r: 1, c: 0 };
		case "LEFT":
			return { r: 0, c: -1 };
		case "RIGHT":
			return { r: 0, c: 1 };
		default:
			return { r: 0, c: 0 };
	}
};

export const getTraversals = (direction: Direction): { x: number[]; y: number[] } => {
	const traversals = { x: [0, 1, 2, 3], y: [0, 1, 2, 3] };
	if (direction === "RIGHT") traversals.x.reverse();
	if (direction === "DOWN") traversals.y.reverse();
	return traversals;
};

export const findFurthestPosition = (
	grid: (Tile | null)[][],
	r: number,
	c: number,
	dir: Direction
): { targetR: number; targetC: number; nextTile: Tile | null } => {
	const vector = getVector(dir);
	let prevR = r,
		prevC = c;
	let currentR = r + vector.r,
		currentC = c + vector.c;

	while (
		currentR >= 0 &&
		currentR < GRID_SIZE &&
		currentC >= 0 &&
		currentC < GRID_SIZE &&
		grid[currentR][currentC] === null
	) {
		prevR = currentR;
		prevC = currentC;
		currentR += vector.r;
		currentC += vector.c;
	}

	let nextTile: Tile | null = null;
	if (
		currentR >= 0 &&
		currentR < GRID_SIZE &&
		currentC >= 0 &&
		currentC < GRID_SIZE
	) {
		nextTile = grid[currentR][currentC];
	}

	return { targetR: prevR, targetC: prevC, nextTile };
};

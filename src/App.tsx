import { useCallback, useEffect, useState } from "react";
import {
	GRID_SIZE,
	WIN_TILE,
	getTileColor,
	getTileFontSize,
} from "./constants";
import {
	addRandomTile,
	checkGameOver,
	findFurthestPosition,
	getTraversals,
} from "./gameLogic";
import { useGameControls } from "./hooks/useGameControls";
import type { Direction, Tile } from "./types";
import { soundEffects } from "./utils/sound";

export default function App() {
	const [tiles, setTiles] = useState<Tile[]>(() =>
		addRandomTile(addRandomTile([])),
	);
	const [score, setScore] = useState(0);
	const [bestScore, setBestScore] = useState(() => {
		const savedBest = localStorage.getItem("2048-best-score");
		return savedBest ? parseInt(savedBest, 10) : 0;
	});
	const [gameOver, setGameOver] = useState(false);
	const [gameWon, setGameWon] = useState(false);
	const [hasWon, setHasWon] = useState(false);
	const [isMuted, setIsMuted] = useState(() => soundEffects.isMuted());

	const toggleSound = () => {
		const next = soundEffects.toggleMuted();
		setIsMuted(next);
	};

	// Clean up animation flags after transitions end
	useEffect(() => {
		if (tiles.some((t) => t.isDestroying || t.isNew || t.isMerged)) {
			const timer = setTimeout(() => {
				setTiles((prev) =>
					prev
						.filter((t) => !t.isDestroying)
						.map((t) => ({
							...t,
							isNew: false,
							isMerged: false,
						})),
				);
			}, 200); // 100ms slide + 100ms pop
			return () => clearTimeout(timer);
		}
	}, [tiles]);

	const move = useCallback(
		(direction: Direction) => {
			if (gameOver || (gameWon && !hasWon)) return;

			setTiles((prevTiles) => {
				let moved = false;
				let scoreIncrease = 0;
				const newTiles: Tile[] = [];
				const destroyingTiles: Tile[] = [];
				const mergedValues: number[] = [];

				const grid: (Tile | null)[][] = Array(GRID_SIZE)
					.fill(null)
					.map(() => Array(GRID_SIZE).fill(null));
				prevTiles.forEach((t) => {
					if (!t.isDestroying) {
						grid[t.r][t.c] = { ...t, isNew: false, isMerged: false };
					}
				});

				const traversals = getTraversals(direction);

				traversals.y.forEach((r) => {
					traversals.x.forEach((c) => {
						const tile = grid[r][c];
						if (tile) {
							const { targetR, targetC, nextTile } = findFurthestPosition(
								grid,
								r,
								c,
								direction,
							);

							// Merge if values match and target tile hasn't already merged this turn
							if (
								nextTile &&
								nextTile.value === tile.value &&
								!nextTile.isMerged
							) {
								moved = true;
								scoreIncrease += tile.value * 2;

								nextTile.value *= 2;
								nextTile.isMerged = true;
								mergedValues.push(nextTile.value);

								tile.r = nextTile.r;
								tile.c = nextTile.c;
								tile.isDestroying = true;
								destroyingTiles.push(tile);

								grid[r][c] = null;
							} else {
								if (targetR !== r || targetC !== c) {
									moved = true;
									grid[r][c] = null;
									grid[targetR][targetC] = tile;
									tile.r = targetR;
									tile.c = targetC;
								}
							}
						}
					});
				});

				if (!moved) return prevTiles;

				grid.forEach((row) =>
					row.forEach((tile) => {
						if (tile) newTiles.push(tile);
					}),
				);

				const mergedTiles = [...newTiles, ...destroyingTiles];
				const finalTiles = addRandomTile(mergedTiles);

				setScore((s) => {
					const newScore = s + scoreIncrease;
					setBestScore((prevBest) => {
						if (newScore > prevBest) {
							localStorage.setItem("2048-best-score", newScore.toString());
							return newScore;
						}
						return prevBest;
					});
					return newScore;
				});

				if (!hasWon && finalTiles.some((t) => t.value === WIN_TILE)) {
					setGameWon(true);
					soundEffects.playVictoryFanfare();
				} else if (mergedValues.length > 0) {
					soundEffects.playMerge(Math.max(...mergedValues));
				}

				if (checkGameOver(finalTiles)) {
					setGameOver(true);
					soundEffects.playGameOver();
				}

				return finalTiles;
			});
		},
		[gameOver, gameWon, hasWon],
	);

	const { pointerHandlers } = useGameControls({ move });

	const restartGame = () => {
		setTiles(addRandomTile(addRandomTile([])));
		setScore(0);
		setGameOver(false);
		setGameWon(false);
		setHasWon(false);
	};

	return (
		<div
			className="min-h-screen bg-[#faf8ef] flex flex-col items-center justify-center p-3 sm:p-4 font-sans select-none text-[#776e65] overflow-hidden"
			style={{ touchAction: "none" }}
			onPointerDown={pointerHandlers.onPointerDown}
			onPointerMove={pointerHandlers.onPointerMove}
			onPointerUp={pointerHandlers.onPointerUp}
			onPointerCancel={pointerHandlers.onPointerCancel}
			onContextMenu={(e) => e.preventDefault()}
			onDragStart={(e) => e.preventDefault()}
		>
			<div className="w-full max-w-[min(90vw,60vh)] flex flex-col items-center">
				{/* Header Section */}
				<div className="w-full mb-6 sm:mb-8 flex justify-between items-center">
					<h1 className="text-[clamp(3.5rem,7.5vmin,6.5rem)] font-bold leading-none">
						2048
					</h1>
					<div className="flex gap-2 sm:gap-3 text-white">
						<div className="bg-[#bbada0] rounded-lg p-[clamp(0.5rem,1.2vmin,1.1rem)] text-center min-w-[clamp(70px,11vmin,125px)]">
							<div className="text-[clamp(0.7rem,1.4vmin,1.1rem)] font-bold uppercase text-[#eee4da]">
								Score
							</div>
							<div className="text-[clamp(1.4rem,3vmin,2.8rem)] font-bold leading-tight">
								{score}
							</div>
						</div>
						<div className="bg-[#bbada0] rounded-lg p-[clamp(0.5rem,1.2vmin,1.1rem)] text-center min-w-[clamp(70px,11vmin,125px)]">
							<div className="text-[clamp(0.7rem,1.4vmin,1.1rem)] font-bold uppercase text-[#eee4da]">
								Best
							</div>
							<div className="text-[clamp(1.4rem,3vmin,2.8rem)] font-bold leading-tight">
								{bestScore}
							</div>
						</div>
					</div>
				</div>

				<div className="w-full mb-4 sm:mb-6 flex justify-between items-center">
					<p className="text-[clamp(0.95rem,2.1vmin,1.8rem)] hidden sm:block font-medium">
						Join the numbers to get to{" "}
						<strong className="text-[clamp(1.1rem,2.4vmin,2.1rem)]">
							2048!
						</strong>
					</p>
					<div className="flex items-center gap-2 sm:gap-3">
						<button
							onClick={toggleSound}
							aria-label={isMuted ? "Unmute sound" : "Mute sound"}
							title={isMuted ? "Sound: Off" : "Sound: On"}
							className="bg-[#8f7a66] hover:bg-[#9f8b77] text-white p-[clamp(0.6rem,1.3vmin,1.2rem)] rounded-lg transition-colors focus:ring-4 focus:ring-amber-900 outline-none cursor-pointer flex items-center justify-center aspect-square"
						>
							{isMuted ? (
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="currentColor"
									className="w-[clamp(1.1rem,2.2vmin,1.8rem)] h-[clamp(1.1rem,2.2vmin,1.8rem)]"
								>
									<path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.5A2.25 2.25 0 002.25 9.75v4.5A2.25 2.25 0 004.5 16.5h1.94l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 101.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 00-1.06-1.06l-1.72 1.72-1.72-1.72z" />
								</svg>
							) : (
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="currentColor"
									className="w-[clamp(1.1rem,2.2vmin,1.8rem)] h-[clamp(1.1rem,2.2vmin,1.8rem)]"
								>
									<path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.5A2.25 2.25 0 002.25 9.75v4.5A2.25 2.25 0 004.5 16.5h1.94l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06zM15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
								</svg>
							)}
						</button>
						<button
							onClick={restartGame}
							className="bg-[#8f7a66] hover:bg-[#9f8b77] text-white font-bold py-[clamp(0.6rem,1.3vmin,1.2rem)] px-[clamp(1.2rem,2.4vmin,2.4rem)] rounded-lg text-[clamp(1rem,2.2vmin,1.8rem)] transition-colors focus:ring-4 focus:ring-amber-900 outline-none cursor-pointer"
						>
							New Game
						</button>
					</div>
				</div>

				{/* Game Board Container */}
				<div
					className="relative bg-[#bbada0] p-[clamp(0.75rem,1.8vmin,1.6rem)] rounded-xl sm:rounded-2xl w-full aspect-square shadow-2xl"
					style={
						{ "--gap": "clamp(0.6rem, 1.8vmin, 1.5rem)" } as React.CSSProperties
					} // Configurable gap variable controlling board scaling
				>
					{/* Static Background Empty Grid */}
					<div
						className="grid grid-cols-4 grid-rows-4 w-full h-full"
						style={{ gap: "var(--gap)" }}
					>
						{Array.from({ length: 16 }).map((_, i) => (
							<div
								key={`empty-${i}`}
								className="bg-[#cdc1b4] rounded-lg w-full h-full"
							/>
						))}
					</div>

					{/* Absolute Moving Tiles Overlay */}
					<div className="absolute top-[clamp(0.75rem,1.8vmin,1.6rem)] left-[clamp(0.75rem,1.8vmin,1.6rem)] right-[clamp(0.75rem,1.8vmin,1.6rem)] bottom-[clamp(0.75rem,1.8vmin,1.6rem)] pointer-events-none">
						{tiles.map((t) => (
							<div
								key={t.id}
								className={`absolute top-0 left-0 transition-transform duration-100 ease-in-out`}
								style={{
									width: "calc((100% - var(--gap) * 3) / 4)",
									height: "calc((100% - var(--gap) * 3) / 4)",
									// Translate shifts element by its *own size* plus the gap
									transform: `translate(calc(${t.c} * (100% + var(--gap))), calc(${t.r} * (100% + var(--gap))))`,
									zIndex: t.isDestroying ? 10 : 20,
								}}
							>
								{/* Inner wrapper applies the scale animations independently of the translation */}
								<div
									className={`w-full h-full flex items-center justify-center rounded-lg font-bold ${getTileFontSize(t.value)} ${getTileColor(t.value)} ${t.isNew ? "animate-appear" : ""} ${t.isMerged ? "animate-pop" : ""}`}
								>
									{t.value}
								</div>
							</div>
						))}
					</div>

					{/* Overlay for Game Over / Win */}
					{(gameOver || gameWon) && (
						<div className="absolute inset-0 bg-[#eee4da] bg-opacity-75 z-50 flex flex-col items-center justify-center rounded-xl animate-fade-in backdrop-blur-sm">
							<h2 className="text-[clamp(2.5rem,6.5vmin,5.5rem)] font-bold text-[#776e65] mb-6 drop-shadow-md">
								{gameWon ? "You Win!" : "Game Over!"}
							</h2>
							<div className="flex gap-4">
								{gameWon && (
									<button
										onClick={() => {
											setGameWon(false);
											setHasWon(true);
										}}
										className="bg-[#8f7a66] text-white font-bold py-[clamp(0.75rem,1.8vmin,1.5rem)] px-[clamp(1.5rem,3.2vmin,3rem)] rounded-lg text-[clamp(1.2rem,2.6vmin,2.4rem)] hover:bg-[#9f8b77] transition-colors shadow-lg focus:ring-4 focus:ring-amber-900 outline-none pointer-events-auto"
									>
										Keep Going
									</button>
								)}
								<button
									onClick={restartGame}
									className="bg-[#8f7a66] text-white font-bold py-[clamp(0.75rem,1.8vmin,1.5rem)] px-[clamp(1.5rem,3.2vmin,3rem)] rounded-lg text-[clamp(1.2rem,2.6vmin,2.4rem)] hover:bg-[#9f8b77] transition-colors shadow-lg focus:ring-4 focus:ring-amber-900 outline-none pointer-events-auto"
								>
									Try Again
								</button>
							</div>
						</div>
					)}
				</div>

				{/* On-Screen Directional Controls (D-Pad) for TV Remote Pointer & Mouse */}
				<div className="mt-4 sm:mt-5 flex flex-col items-center select-none pointer-events-auto">
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							move("UP");
						}}
						aria-label="Move Up"
						title="Move Up"
						className="w-[clamp(2.75rem,5.5vmin,3.5rem)] h-[clamp(2.25rem,4.5vmin,2.75rem)] bg-[#bbada0] hover:bg-[#8f7a66] active:scale-95 text-white rounded-lg shadow transition-all cursor-pointer flex items-center justify-center focus:ring-2 focus:ring-amber-900 outline-none"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							className="w-[clamp(1.2rem,2.5vmin,1.6rem)] h-[clamp(1.2rem,2.5vmin,1.6rem)]"
						>
							<path
								fillRule="evenodd"
								d="M11.47 7.72a.75.75 0 011.06 0l7.5 7.5a.75.75 0 11-1.06 1.06L12 9.31l-6.97 6.97a.75.75 0 01-1.06-1.06l7.5-7.5z"
								clipRule="evenodd"
							/>
						</svg>
					</button>
					<div className="flex gap-[clamp(2.5rem,5vmin,3.5rem)] my-1 sm:my-1.5">
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								move("LEFT");
							}}
							aria-label="Move Left"
							title="Move Left"
							className="w-[clamp(2.75rem,5.5vmin,3.5rem)] h-[clamp(2.25rem,4.5vmin,2.75rem)] bg-[#bbada0] hover:bg-[#8f7a66] active:scale-95 text-white rounded-lg shadow transition-all cursor-pointer flex items-center justify-center focus:ring-2 focus:ring-amber-900 outline-none"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								className="w-[clamp(1.2rem,2.5vmin,1.6rem)] h-[clamp(1.2rem,2.5vmin,1.6rem)]"
							>
								<path
									fillRule="evenodd"
									d="M7.72 12.53a.75.75 0 010-1.06l7.5-7.5a.75.75 0 111.06 1.06L9.31 12l6.97 6.97a.75.75 0 11-1.06 1.06l-7.5-7.5z"
									clipRule="evenodd"
								/>
							</svg>
						</button>
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								move("RIGHT");
							}}
							aria-label="Move Right"
							title="Move Right"
							className="w-[clamp(2.75rem,5.5vmin,3.5rem)] h-[clamp(2.25rem,4.5vmin,2.75rem)] bg-[#bbada0] hover:bg-[#8f7a66] active:scale-95 text-white rounded-lg shadow transition-all cursor-pointer flex items-center justify-center focus:ring-2 focus:ring-amber-900 outline-none"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								className="w-[clamp(1.2rem,2.5vmin,1.6rem)] h-[clamp(1.2rem,2.5vmin,1.6rem)]"
							>
								<path
									fillRule="evenodd"
									d="M16.28 11.47a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 01-1.06-1.06L14.69 12 7.72 5.03a.75.75 0 011.06-1.06l7.5 7.5z"
									clipRule="evenodd"
								/>
							</svg>
						</button>
					</div>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							move("DOWN");
						}}
						aria-label="Move Down"
						title="Move Down"
						className="w-[clamp(2.75rem,5.5vmin,3.5rem)] h-[clamp(2.25rem,4.5vmin,2.75rem)] bg-[#bbada0] hover:bg-[#8f7a66] active:scale-95 text-white rounded-lg shadow transition-all cursor-pointer flex items-center justify-center focus:ring-2 focus:ring-amber-900 outline-none"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							className="w-[clamp(1.2rem,2.5vmin,1.6rem)] h-[clamp(1.2rem,2.5vmin,1.6rem)]"
						>
							<path
								fillRule="evenodd"
								d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 111.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z"
								clipRule="evenodd"
							/>
						</svg>
					</button>
				</div>

				<div className="mt-3 sm:mt-4 text-center text-[clamp(0.85rem,1.8vmin,1.4rem)] text-[#776e65] font-medium w-full opacity-70">
					<p>
						Use <strong className="text-gray-800">Arrow Keys</strong>,{" "}
						<strong className="text-gray-800">D-Pad</strong>, or{" "}
						<strong className="text-gray-800">Drag / Swipe</strong> to move
						tiles.
					</p>
				</div>
			</div>
		</div>
	);
}

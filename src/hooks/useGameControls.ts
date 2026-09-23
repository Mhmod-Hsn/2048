import { useEffect } from "react";
import type { Direction } from "../types";

interface UseGameControlsProps {
	move: (direction: Direction) => void;
}

export function useGameControls({ move }: UseGameControlsProps) {
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (
				["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
			) {
				e.preventDefault();
			}
			switch (e.key) {
				case "ArrowUp":
				case "w":
				case "W":
					move("UP");
					break;
				case "ArrowDown":
				case "s":
				case "S":
					move("DOWN");
					break;
				case "ArrowLeft":
				case "a":
				case "A":
					move("LEFT");
					break;
				case "ArrowRight":
				case "d":
				case "D":
					move("RIGHT");
					break;
				default:
					break;
			}
		};
		window.addEventListener("keydown", handleKeyDown, { passive: false });
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [move]);
}

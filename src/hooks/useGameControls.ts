import { useCallback, useEffect, useRef } from "react";
import type { Direction } from "../types";

interface UseGameControlsProps {
	move: (direction: Direction) => void;
}

export function useGameControls({ move }: UseGameControlsProps) {
	const lastWheelTime = useRef(0);
	const isDragging = useRef(false);
	const pointerStart = useRef({ x: 0, y: 0 });
	const hasTriggeredMove = useRef(false);

	useEffect(() => {
		// Register Samsung Tizen remote keys if running on Tizen TV
		try {
			// @ts-expect-error Samsung Tizen key registration
			if (typeof window !== "undefined" && window.tizen?.tvinputdevice?.registerKey) {
				const keysToRegister = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter"];
				keysToRegister.forEach((k) => {
					try {
						// @ts-expect-error Samsung Tizen key registration
						window.tizen.tvinputdevice.registerKey(k);
					} catch {
						// ignore if not supported
					}
				});
			}
		} catch {
			// ignore
		}

		const handleKeyDown = (e: KeyboardEvent) => {
			const code = e.keyCode || e.which;
			const key = e.key;

			const isUp =
				key === "ArrowUp" ||
				key === "Up" ||
				key === "w" ||
				key === "W" ||
				key === "k" ||
				key === "K" ||
				code === 38 || // ArrowUp / WebOS / Tizen UP
				code === 19; // Android TV DPAD_UP

			const isDown =
				key === "ArrowDown" ||
				key === "Down" ||
				key === "s" ||
				key === "S" ||
				key === "j" ||
				key === "J" ||
				code === 40 || // ArrowDown / WebOS / Tizen DOWN
				code === 20; // Android TV DPAD_DOWN

			const isLeft =
				key === "ArrowLeft" ||
				key === "Left" ||
				key === "a" ||
				key === "A" ||
				key === "h" ||
				key === "H" ||
				code === 37 || // ArrowLeft / WebOS / Tizen LEFT
				code === 21; // Android TV DPAD_LEFT

			const isRight =
				key === "ArrowRight" ||
				key === "Right" ||
				key === "d" ||
				key === "D" ||
				key === "l" ||
				key === "L" ||
				code === 39 || // ArrowRight / WebOS / Tizen RIGHT
				code === 22; // Android TV DPAD_RIGHT

			if (isUp || isDown || isLeft || isRight || key === " " || code === 32) {
				e.preventDefault();
				e.stopPropagation();
			}

			if (isUp) {
				move("UP");
			} else if (isDown) {
				move("DOWN");
			} else if (isLeft) {
				move("LEFT");
			} else if (isRight) {
				move("RIGHT");
			}
		};

		// Support TV Magic Remote / mouse wheel
		const handleWheel = (e: WheelEvent) => {
			e.preventDefault();
			const now = Date.now();
			if (now - lastWheelTime.current < 200) return; // throttle

			if (Math.abs(e.deltaY) > 20) {
				lastWheelTime.current = now;
				if (e.deltaY < 0) move("UP");
				else move("DOWN");
			} else if (Math.abs(e.deltaX) > 20) {
				lastWheelTime.current = now;
				if (e.deltaX < 0) move("LEFT");
				else move("RIGHT");
			}
		};

		window.addEventListener("keydown", handleKeyDown, { passive: false });
		window.addEventListener("wheel", handleWheel, { passive: false });

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("wheel", handleWheel);
		};
	}, [move]);

	const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
		// Only primary button (left click or touch or TV remote select button)
		if (e.button !== 0 && e.pointerType === "mouse") return;
		const target = e.target as HTMLElement;
		if (target.closest("button")) return;

		// Prevent TV browser from engaging native drag-to-scroll / autoscroll mode
		e.preventDefault();

		isDragging.current = true;
		hasTriggeredMove.current = false;
		pointerStart.current = { x: e.clientX, y: e.clientY };

		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			// ignore if not supported
		}
	}, []);

	const onPointerMove = useCallback(
		(e: React.PointerEvent<HTMLElement>) => {
			if (!isDragging.current || hasTriggeredMove.current) return;

			const deltaX = e.clientX - pointerStart.current.x;
			const deltaY = e.clientY - pointerStart.current.y;
			const absX = Math.abs(deltaX);
			const absY = Math.abs(deltaY);

			// Trigger move as soon as swipe threshold is reached
			if (Math.max(absX, absY) > 30) {
				if (absX > absY) {
					move(deltaX > 0 ? "RIGHT" : "LEFT");
				} else {
					move(deltaY > 0 ? "DOWN" : "UP");
				}
				hasTriggeredMove.current = true;
			}
		},
		[move],
	);

	const onPointerUp = useCallback(
		(e: React.PointerEvent<HTMLElement>) => {
			if (isDragging.current && !hasTriggeredMove.current) {
				const deltaX = e.clientX - pointerStart.current.x;
				const deltaY = e.clientY - pointerStart.current.y;
				const absX = Math.abs(deltaX);
				const absY = Math.abs(deltaY);

				if (Math.max(absX, absY) > 20) {
					if (absX > absY) {
						move(deltaX > 0 ? "RIGHT" : "LEFT");
					} else {
						move(deltaY > 0 ? "DOWN" : "UP");
					}
				}
			}
			isDragging.current = false;
			hasTriggeredMove.current = false;
			try {
				if (e.currentTarget.hasPointerCapture(e.pointerId)) {
					e.currentTarget.releasePointerCapture(e.pointerId);
				}
			} catch {
				// ignore
			}
		},
		[move],
	);

	const onPointerCancel = useCallback((e: React.PointerEvent<HTMLElement>) => {
		isDragging.current = false;
		hasTriggeredMove.current = false;
		try {
			if (e.currentTarget.hasPointerCapture(e.pointerId)) {
				e.currentTarget.releasePointerCapture(e.pointerId);
			}
		} catch {
			// ignore
		}
	}, []);

	return {
		pointerHandlers: {
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onPointerCancel,
		},
	};
}



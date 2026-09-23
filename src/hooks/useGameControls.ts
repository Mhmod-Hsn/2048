import { useCallback, useEffect, useRef } from "react";
import type { Direction } from "../types";

interface UseGameControlsProps {
	move: (direction: Direction) => void;
}

export function useGameControls({ move }: UseGameControlsProps) {
	const lastWheelTime = useRef(0);

	// TV Air Remote / Mouse hover tracking:
	// On TV Magic Remotes the cursor moves freely WITHOUT holding a button.
	// We record the cursor's hover trajectory, then on click (OK/Select press)
	// we look back at where it came from to infer the intended swipe direction.
	const hoverHistory = useRef<{ x: number; y: number; t: number }[]>([]);
	const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

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

		// Support TV Magic Remote scroll wheel / trackpad swipe
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

		// Record hover positions so we can infer direction for TV Air Remote clicks.
		// The remote moves the cursor WITHOUT holding any button, so we track it
		// passively and read the trajectory when the OK/Select button is pressed.
		const handleMouseMove = (e: MouseEvent) => {
			if (e.buttons !== 0) return; // skip real drags
			const now = Date.now();
			hoverHistory.current.push({ x: e.clientX, y: e.clientY, t: now });
			// Keep only the last 500 ms of history
			const cutoff = now - 500;
			hoverHistory.current = hoverHistory.current.filter((p) => p.t > cutoff);
		};

		window.addEventListener("keydown", handleKeyDown, { passive: false });
		window.addEventListener("wheel", handleWheel, { passive: false });
		window.addEventListener("mousemove", handleMouseMove, { passive: true });

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			window.removeEventListener("wheel", handleWheel);
			window.removeEventListener("mousemove", handleMouseMove);
		};
	}, [move]);

	// Infer swipe direction from the hover history leading up to a click
	const inferDirectionFromHover = useCallback(
		(clickX: number, clickY: number): Direction | null => {
			const history = hoverHistory.current;
			if (history.length < 2) return null;

			// Compare the earliest recent position to the click position
			const start = history[0];
			const deltaX = clickX - start.x;
			const deltaY = clickY - start.y;
			const absX = Math.abs(deltaX);
			const absY = Math.abs(deltaY);

			// Require at least 15 px of movement to avoid accidental triggers
			if (Math.max(absX, absY) < 15) return null;

			if (absX > absY) return deltaX > 0 ? "RIGHT" : "LEFT";
			return deltaY > 0 ? "DOWN" : "UP";
		},
		[],
	);

	const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
		if (e.button !== 0 && e.pointerType === "mouse") return;
		const target = e.target as HTMLElement;
		if (target.closest("button")) return;
		e.preventDefault();
		pointerDownPos.current = { x: e.clientX, y: e.clientY };
		try {
			e.currentTarget.setPointerCapture(e.pointerId);
		} catch {
			// ignore if not supported
		}
	}, []);

	const onPointerMove = useCallback(
		(e: React.PointerEvent<HTMLElement>) => {
			// Only react when a button is actually held (real drag, not air-remote hover)
			if (e.buttons === 0 || pointerDownPos.current === null) return;

			const deltaX = e.clientX - pointerDownPos.current.x;
			const deltaY = e.clientY - pointerDownPos.current.y;
			const absX = Math.abs(deltaX);
			const absY = Math.abs(deltaY);

			if (Math.max(absX, absY) > 30) {
				if (absX > absY) move(deltaX > 0 ? "RIGHT" : "LEFT");
				else move(deltaY > 0 ? "DOWN" : "UP");

				pointerDownPos.current = null; // consume — prevent repeat
				hoverHistory.current = [];
				try {
					if (e.currentTarget.hasPointerCapture(e.pointerId)) {
						e.currentTarget.releasePointerCapture(e.pointerId);
					}
				} catch {
					// ignore
				}
			}
		},
		[move],
	);

	const onPointerUp = useCallback(
		(e: React.PointerEvent<HTMLElement>) => {
			const target = e.target as HTMLElement;
			if (target.closest("button")) {
				pointerDownPos.current = null;
				hoverHistory.current = [];
				return;
			}

			if (pointerDownPos.current !== null) {
				const { x: downX, y: downY } = pointerDownPos.current;
				const deltaX = e.clientX - downX;
				const deltaY = e.clientY - downY;
				const absX = Math.abs(deltaX);
				const absY = Math.abs(deltaY);

				if (Math.max(absX, absY) > 20) {
					// Standard mouse/touch drag
					if (absX > absY) move(deltaX > 0 ? "RIGHT" : "LEFT");
					else move(deltaY > 0 ? "DOWN" : "UP");
				} else {
					// TV Air Remote: pointer barely moved while button was held,
					// so infer direction from the hover trajectory before the click
					const dir = inferDirectionFromHover(e.clientX, e.clientY);
					if (dir) move(dir);
				}
			}

			pointerDownPos.current = null;
			hoverHistory.current = [];

			try {
				if (e.currentTarget.hasPointerCapture(e.pointerId)) {
					e.currentTarget.releasePointerCapture(e.pointerId);
				}
			} catch {
				// ignore
			}
		},
		[move, inferDirectionFromHover],
	);

	const onPointerCancel = useCallback((e: React.PointerEvent<HTMLElement>) => {
		pointerDownPos.current = null;
		hoverHistory.current = [];
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

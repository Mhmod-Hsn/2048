import { useCallback, useEffect, useRef } from "react";
import type { Direction } from "../types";

interface UseGameControlsProps {
	move: (direction: Direction) => void;
}

export function useGameControls({ move }: UseGameControlsProps) {
	const lastWheelTime = useRef(0);
	const hoverHistory = useRef<{ x: number; y: number; t: number }[]>([]);
	const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

	useEffect(() => {
		// Register Samsung Tizen remote D-Pad keys (required on some Tizen versions)
		try {
			// @ts-expect-error Samsung Tizen API
			if (typeof window.tizen !== "undefined" && window.tizen?.tvinputdevice) {
				["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].forEach((k) => {
					try {
						// @ts-expect-error Samsung Tizen API
						window.tizen.tvinputdevice.registerKey(k);
					} catch {
						/* ignore */
					}
				});
			}
		} catch {
			/* ignore */
		}

		// Ensure page has focus so keyboard events are received.
		// On TV browsers the page can lose focus to the browser chrome.
		if (document.activeElement === document.body || !document.activeElement) {
			document.body.focus();
		}

		const handleKeyDown = (e: KeyboardEvent) => {
			const code = e.keyCode || e.which;
			const key = e.key;

			const isUp =
				key === "ArrowUp" || key === "Up" || key === "w" || key === "W" || key === "k" ||
				code === 38 || code === 19; // 19 = Android DPAD_UP

			const isDown =
				key === "ArrowDown" || key === "Down" || key === "s" || key === "S" || key === "j" ||
				code === 40 || code === 20; // 20 = Android DPAD_DOWN

			const isLeft =
				key === "ArrowLeft" || key === "Left" || key === "a" || key === "A" || key === "h" ||
				code === 37 || code === 21; // 21 = Android DPAD_LEFT

			const isRight =
				key === "ArrowRight" || key === "Right" || key === "d" || key === "D" || key === "l" ||
				code === 39 || code === 22; // 22 = Android DPAD_RIGHT

			if (isUp || isDown || isLeft || isRight) {
				// Stop the TV browser from using this event for spatial navigation
				e.preventDefault();
				e.stopImmediatePropagation();

				if (isUp) move("UP");
				else if (isDown) move("DOWN");
				else if (isLeft) move("LEFT");
				else if (isRight) move("RIGHT");
			}
		};

		// Scroll wheel / TV Magic Remote trackpad
		const handleWheel = (e: WheelEvent) => {
			e.preventDefault();
			const now = Date.now();
			if (now - lastWheelTime.current < 200) return;

			if (Math.abs(e.deltaY) > 20) {
				lastWheelTime.current = now;
				move(e.deltaY < 0 ? "UP" : "DOWN");
			} else if (Math.abs(e.deltaX) > 20) {
				lastWheelTime.current = now;
				move(e.deltaX < 0 ? "LEFT" : "RIGHT");
			}
		};

		// Track hover positions for TV Air Remote direction inference.
		// Air-remote cursors move WITHOUT holding any button, so we read
		// the trajectory and infer direction when the OK/Select is pressed.
		const handleMouseMove = (e: MouseEvent) => {
			if (e.buttons !== 0) return; // skip real drags
			const now = Date.now();
			hoverHistory.current.push({ x: e.clientX, y: e.clientY, t: now });
			const cutoff = now - 500;
			hoverHistory.current = hoverHistory.current.filter((p) => p.t > cutoff);
		};

		// Use capture:true so we intercept in the capture phase,
		// BEFORE the TV browser's spatial navigation engine handles it.
		document.addEventListener("keydown", handleKeyDown, { capture: true, passive: false });
		document.addEventListener("wheel", handleWheel, { capture: true, passive: false });
		document.addEventListener("mousemove", handleMouseMove, { passive: true });

		return () => {
			document.removeEventListener("keydown", handleKeyDown, { capture: true });
			document.removeEventListener("wheel", handleWheel, { capture: true });
			document.removeEventListener("mousemove", handleMouseMove);
		};
	}, [move]);

	// Infer swipe direction from hover history leading up to a click
	const inferDirectionFromHover = useCallback(
		(clickX: number, clickY: number): Direction | null => {
			const history = hoverHistory.current;
			if (history.length < 2) return null;

			const start = history[0];
			const deltaX = clickX - start.x;
			const deltaY = clickY - start.y;
			const absX = Math.abs(deltaX);
			const absY = Math.abs(deltaY);

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
			/* ignore */
		}
	}, []);

	const onPointerMove = useCallback(
		(e: React.PointerEvent<HTMLElement>) => {
			if (e.buttons === 0 || pointerDownPos.current === null) return;

			const deltaX = e.clientX - pointerDownPos.current.x;
			const deltaY = e.clientY - pointerDownPos.current.y;
			const absX = Math.abs(deltaX);
			const absY = Math.abs(deltaY);

			if (Math.max(absX, absY) > 30) {
				if (absX > absY) move(deltaX > 0 ? "RIGHT" : "LEFT");
				else move(deltaY > 0 ? "DOWN" : "UP");

				pointerDownPos.current = null;
				hoverHistory.current = [];
				try {
					if (e.currentTarget.hasPointerCapture(e.pointerId)) {
						e.currentTarget.releasePointerCapture(e.pointerId);
					}
				} catch {
					/* ignore */
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
					// TV Air Remote: infer from hover trajectory
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
				/* ignore */
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
			/* ignore */
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

// Web Audio API Synthesizer for 2048
// Pure client-side synthesis: zero external audio files, zero latency, works offline.

class SoundEffects {
	private ctx: AudioContext | null = null;
	private muted: boolean = false;

	private lastSoundKey: string = "";
	private lastSoundTime: number = 0;

	constructor() {
		// Restore sound preference from localStorage if available
		const savedMute = localStorage.getItem("2048-sound-muted");
		this.muted = savedMute === "true";
	}

	private shouldThrottle(key: string): boolean {
		const now = typeof performance !== "undefined" ? performance.now() : Date.now();
		if (this.lastSoundKey === key && now - this.lastSoundTime < 60) {
			return true;
		}
		this.lastSoundKey = key;
		this.lastSoundTime = now;
		return false;
	}

	private getAudioContext(): AudioContext | null {
		if (typeof window === "undefined") return null;

		if (!this.ctx) {
			const AudioContextClass =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (AudioContextClass) {
				this.ctx = new AudioContextClass();
			}
		}

		if (this.ctx && this.ctx.state === "suspended") {
			this.ctx.resume();
		}

		return this.ctx;
	}

	public isMuted(): boolean {
		return this.muted;
	}

	public setMuted(muted: boolean): void {
		this.muted = muted;
		localStorage.setItem("2048-sound-muted", muted.toString());
	}

	public toggleMuted(): boolean {
		this.setMuted(!this.muted);
		return this.muted;
	}

	/**
	 * Play a cheerful, bright chime when cells merge.
	 * Pitch scales musically with the merged tile value.
	 */
	public playMerge(value: number): void {
		if (this.muted) return;
		if (this.shouldThrottle(`merge-${value}`)) return;
		const ctx = this.getAudioContext();
		if (!ctx) return;

		// If winning tile (2048 or higher), play celebratory fanfare
		if (value >= 2048) {
			this.playVictoryFanfare();
			return;
		}

		// Pentatonic / chromatic scale mapping for satisfying game progression:
		// 4: C5 (523Hz), 8: D5 (587Hz), 16: E5 (659Hz), 32: G5 (784Hz), 64: A5 (880Hz),
		// 128: C6 (1046Hz), 256: D6 (1175Hz), 512: E6 (1318Hz), 1024: G6 (1568Hz)
		const noteFrequencies: Record<number, number> = {
			4: 523.25, // C5
			8: 587.33, // D5
			16: 659.25, // E5
			32: 783.99, // G5
			64: 880.0, // A5
			128: 1046.5, // C6
			256: 1174.66, // D6
			512: 1318.51, // E6
			1024: 1567.98, // G6
		};

		const baseFreq = noteFrequencies[value] || (523.25 * Math.log2(value)) / 2;
		const now = ctx.currentTime;

		// Create oscillator and gain node
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();

		// Blend sine with subtle harmonic for a warm marimba/bubble tone
		osc.type = "sine";
		osc.frequency.setValueAtTime(baseFreq, now);
		// Gentle upward pitch sweep on merge for bubbly feel
		osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.08, now + 0.08);

		// Envelope: rapid attack, quick exponential decay
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(0.28, now + 0.015);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

		osc.connect(gain);
		gain.connect(ctx.destination);

		osc.start(now);
		osc.stop(now + 0.18);

		// Layer a secondary harmonic overtone for high values (>= 64)
		if (value >= 64) {
			const overtone = ctx.createOscillator();
			const overtoneGain = ctx.createGain();

			overtone.type = "triangle";
			overtone.frequency.setValueAtTime(baseFreq * 1.5, now); // perfect fifth overtone
			overtoneGain.gain.setValueAtTime(0.0001, now);
			overtoneGain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
			overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

			overtone.connect(overtoneGain);
			overtoneGain.connect(ctx.destination);

			overtone.start(now);
			overtone.stop(now + 0.16);
		}
	}

	/**
	 * Play victorious fanfare (arpeggiated major chord) when reaching 2048+
	 */
	public playVictoryFanfare(): void {
		if (this.muted) return;
		if (this.shouldThrottle("victory")) return;
		const ctx = this.getAudioContext();
		if (!ctx) return;

		const now = ctx.currentTime;
		// C6, E6, G6, C7 arpeggio
		const chord = [1046.5, 1318.51, 1567.98, 2093.0];

		chord.forEach((freq, index) => {
			const noteTime = now + index * 0.08;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();

			osc.type = "triangle";
			osc.frequency.setValueAtTime(freq, noteTime);

			gain.gain.setValueAtTime(0.0001, noteTime);
			gain.gain.exponentialRampToValueAtTime(0.3, noteTime + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.35);

			osc.connect(gain);
			gain.connect(ctx.destination);

			osc.start(noteTime);
			osc.stop(noteTime + 0.38);
		});
	}

	/**
	 * Play game-over sound (descending minor chime)
	 */
	public playGameOver(): void {
		if (this.muted) return;
		if (this.shouldThrottle("gameover")) return;
		const ctx = this.getAudioContext();
		if (!ctx) return;

		const now = ctx.currentTime;
		const notes = [440, 415.3, 392, 349.23]; // descending minor sequence

		notes.forEach((freq, index) => {
			const noteTime = now + index * 0.12;
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();

			osc.type = "sine";
			osc.frequency.setValueAtTime(freq, noteTime);

			gain.gain.setValueAtTime(0.0001, noteTime);
			gain.gain.exponentialRampToValueAtTime(0.18, noteTime + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.28);

			osc.connect(gain);
			gain.connect(ctx.destination);

			osc.start(noteTime);
			osc.stop(noteTime + 0.3);
		});
	}
}

export const soundEffects = new SoundEffects();

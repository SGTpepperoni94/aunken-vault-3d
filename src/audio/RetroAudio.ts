/**
 * 100% Procedural Web Audio API sound effects & adaptive dark-fantasy ambience.
 * Zero external audio files. Auto-unlocks on first user gesture.
 */
export class RetroAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private bossMode = false;
  private muted = false;
  private pulseTimer = 0;

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(mute ? 0 : 0.32, this.ctx.currentTime, 0.04);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  unlock(): void {
    try {
      const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
      if (ua && !ua.hasBeenActive) return;
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.32;
        this.masterGain.connect(this.ctx.destination);
        this.startAmbientDrone();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
    } catch {
      // Headless or audio-restricted browser fallback
    }
  }

  private startAmbientDrone(): void {
    if (!this.ctx || !this.masterGain || this.ambientOsc1) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.09;

    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 55; // Deep A1 dungeon drone

    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 82.41; // E2 eerie fifth

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start();
    osc2.start();
    this.ambientOsc1 = osc1;
    this.ambientOsc2 = osc2;
    this.ambientGain = gain;
  }

  setBossMode(active: boolean): void {
    this.bossMode = active;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(active ? 0.14 : 0.08, this.ctx.currentTime, 0.3);
    }
  }

  tickAmbient(dt: number, paused: boolean): void {
    if (!this.ctx || !this.ambientGain || this.muted) return;
    if (paused) {
      this.ambientGain.gain.setTargetAtTime(0.01, this.ctx.currentTime, 0.1);
      return;
    }
    this.ambientGain.gain.setTargetAtTime(this.bossMode ? 0.14 : 0.08, this.ctx.currentTime, 0.2);

    if (this.bossMode) {
      this.pulseTimer -= dt;
      if (this.pulseTimer <= 0) {
        this.pulseTimer = 0.65;
        this.playBossDrum();
      }
    }
  }

  private playBossDrum(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.22);
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  private playNoiseBurst(duration: number, filterFreq: number, gainPeak: number, q = 1.2): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const samples = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buf = this.ctx.createBuffer(1, samples, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < samples; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainPeak, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now);
  }

  playFootstep(): void {
    const pitch = 210 + Math.random() * 70;
    this.playNoiseBurst(0.06, pitch, 0.14, 1.8);
  }

  playSwordSwing(heavy = false): void {
    this.playNoiseBurst(heavy ? 0.22 : 0.12, heavy ? 320 : 520 + Math.random() * 90, heavy ? 0.34 : 0.22, 1.4);
  }

  playSteelHit(heavy = false): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(heavy ? 185 : 240 + Math.random() * 40, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + (heavy ? 0.18 : 0.1));
    g.gain.setValueAtTime(heavy ? 0.38 : 0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.2 : 0.12));
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);
    this.playNoiseBurst(0.08, 900, 0.24, 1.1);
  }

  playParryClang(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const freqs = [880, 1320, 1765];
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.94, now + 0.42);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.46);
    }
  }

  playGuardBlock(): void {
    this.playNoiseBurst(0.09, 440, 0.28, 2.5);
  }

  playPoiseBreak(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.38);
    g.gain.setValueAtTime(0.42, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.42);
  }

  playFireball(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.22);
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
    this.playNoiseBurst(0.2, 650, 0.25, 0.9);
  }

  playResonanceDetonate(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 659.25, 880];
    notes.forEach((n, idx) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n, now + idx * 0.03);
      g.gain.setValueAtTime(0.24, now + idx * 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + idx * 0.04);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + idx * 0.03);
      osc.stop(now + 0.42);
    });
  }

  playLegendaryChime(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      const osc = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n, now + i * 0.08);
      g.gain.setValueAtTime(0.24, now + i * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.55);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.58);
    });
  }

  playPickup(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.setValueAtTime(760, now + 0.06);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playPlayerHurt(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.24);
    g.gain.setValueAtTime(0.36, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  playStanceSwap(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.09);
    g.gain.setValueAtTime(0.15, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playEnemyTelegraph(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.18);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  dispose(): void {
    try {
      this.ambientOsc1?.stop();
      this.ambientOsc2?.stop();
      void this.ctx?.close();
    } catch {
      // Ignore cleanup errors
    }
    this.ctx = null;
  }
}

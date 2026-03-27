const AudioCtxCtor =
  typeof AudioContext !== 'undefined'
    ? AudioContext
    : (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

/**
 * Procedural SFX via Web Audio API: oscillators + noise buffers, optional 3D panning.
 * AudioContext is created lazily; playback only runs after {@link SoundEngine.unlock} (browser autoplay policy).
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume = 1;
  private userAllowed = false;
  private noiseBuffer: AudioBuffer | null = null;
  private pannerPool: PannerNode[] = [];
  private activePanners: { panner: PannerNode; releaseTime: number }[] = [];

  /** Call after a user gesture (e.g. pointer lock). Creates AudioContext and allows playback. */
  unlock(): void {
    this.userAllowed = true;
    const ctx = this.ensureContext();
    void ctx.resume();
  }

  /** Settings volume 0–100 */
  setVolume(percent: number): void {
    this.volume = Math.max(0, Math.min(1, percent / 100));
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }

  updateListener(px: number, py: number, pz: number, fx: number, fy: number, fz: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const lis = ctx.listener;
    if (lis.positionX) {
      lis.positionX.setValueAtTime(px, t);
      lis.positionY.setValueAtTime(py, t);
      lis.positionZ.setValueAtTime(pz, t);
      lis.forwardX.setValueAtTime(fx, t);
      lis.forwardY.setValueAtTime(fy, t);
      lis.forwardZ.setValueAtTime(fz, t);
      lis.upX.setValueAtTime(0, t);
      lis.upY.setValueAtTime(1, t);
      lis.upZ.setValueAtTime(0, t);
    } else {
      lis.setPosition(px, py, pz);
      lis.setOrientation(fx, fy, fz, 0, 1, 0);
    }
  }

  playBreakAt(x: number, y: number, z: number): void {
    const ctx = this.guardContext();
    if (!ctx || !this.masterGain) return;
    const dur = 0.14;
    const buf = this.allocNoiseSlice(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700 + Math.random() * 200;
    const env = ctx.createGain();
    const t0 = ctx.currentTime;
    env.gain.setValueAtTime(0.32, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(env);
    this.spatialize(env, x, y, z, ctx);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  playPlaceAt(x: number, y: number, z: number): void {
    const ctx = this.guardContext();
    if (!ctx || !this.masterGain) return;
    const t0 = ctx.currentTime;
    const base = 95 + Math.random() * 35;
    this.thunkOsc(ctx, t0, base, 0.11, 0.22, x, y, z);
    this.thunkOsc(ctx, t0 + 0.004, base * 2.2, 0.06, 0.1, x, y, z);
  }

  playFootstepAt(x: number, y: number, z: number): void {
    const ctx = this.guardContext();
    if (!ctx || !this.masterGain) return;
    const dur = 0.055;
    const buf = this.allocNoiseSlice(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 480 + Math.random() * 280;
    const env = ctx.createGain();
    const t0 = ctx.currentTime;
    env.gain.setValueAtTime(0.14 + Math.random() * 0.05, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(env);
    this.spatialize(env, x, y, z, ctx);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  playHitAt(x: number, y: number, z: number): void {
    const ctx = this.guardContext();
    if (!ctx || !this.masterGain) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(520 + Math.random() * 120, t0);
    osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.045);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.2, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 180;
    osc.connect(hp);
    hp.connect(env);
    this.spatialize(env, x, y, z, ctx);
    osc.start(t0);
    osc.stop(t0 + 0.09);
    this.noiseClick(ctx, t0 + 0.002, 0.028, 2200, 0.12, x, y, z, true);
  }

  /** Local player damage — stereo only (no world panning) */
  playHurt(): void {
    const ctx = this.guardContext();
    if (!ctx || !this.masterGain) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140 + Math.random() * 40, t0);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.22, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.2);
    this.noiseClick(ctx, t0, 0.05, 400, 0.08, 0, 0, 0, false);
  }

  playWaterSplashAt(x: number, y: number, z: number): void {
    const ctx = this.guardContext();
    if (!ctx || !this.masterGain) return;
    const dur = 0.16;
    const buf = this.allocNoiseSlice(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400 + Math.random() * 400;
    bp.Q.value = 0.85;
    const env = ctx.createGain();
    const t0 = ctx.currentTime;
    env.gain.setValueAtTime(0.26, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(bp);
    bp.connect(env);
    this.spatialize(env, x, y, z, ctx);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  playPickup(): void {
    const ctx = this.guardContext();
    if (!ctx || !this.masterGain) return;
    const t0 = ctx.currentTime;
    const a = ctx.createOscillator();
    a.type = 'sine';
    a.frequency.value = 740;
    const ga = ctx.createGain();
    ga.gain.setValueAtTime(0.07, t0);
    ga.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
    a.connect(ga);
    ga.connect(this.masterGain);
    a.start(t0);
    a.stop(t0 + 0.1);
    const b = ctx.createOscillator();
    b.type = 'sine';
    b.frequency.value = 1080;
    const gb = ctx.createGain();
    gb.gain.setValueAtTime(0.055, t0 + 0.045);
    gb.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    b.connect(gb);
    gb.connect(this.masterGain);
    b.start(t0 + 0.045);
    b.stop(t0 + 0.13);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.pannerPool.length = 0;
    this.activePanners.length = 0;
    this.userAllowed = false;
  }

  private ensureContext(): AudioContext {
    if (!AudioCtxCtor) {
      throw new Error('Web Audio API not available');
    }
    if (!this.ctx) {
      this.ctx = new AudioCtxCtor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private guardContext(): AudioContext | null {
    if (!this.userAllowed) return null;
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }

  private getNoisePool(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer || this.noiseBuffer.sampleRate !== ctx.sampleRate) {
      const len = Math.floor(ctx.sampleRate * 0.5);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  private allocNoiseSlice(ctx: AudioContext, durationSec: number): AudioBuffer {
    const pool = this.getNoisePool(ctx);
    const n = Math.floor(ctx.sampleRate * durationSec);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const dst = buf.getChannelData(0);
    const src = pool.getChannelData(0);
    const maxStart = Math.max(0, src.length - n);
    const start = maxStart > 0 ? Math.floor(Math.random() * maxStart) : 0;
    for (let i = 0; i < n; i++) {
      dst[i] = src[start + i]! * (1 - i / n);
    }
    return buf;
  }

  private createPanner(ctx: AudioContext): PannerNode {
    const p = ctx.createPanner();
    try {
      p.panningModel = 'HRTF';
    } catch {
      p.panningModel = 'equalpower';
    }
    p.distanceModel = 'inverse';
    p.refDistance = 2.2;
    p.maxDistance = 44;
    p.rolloffFactor = 1.15;
    return p;
  }

  private positionPanner(p: PannerNode, x: number, y: number, z: number, ctx: AudioContext): void {
    const t = ctx.currentTime;
    if (p.positionX) {
      p.positionX.setValueAtTime(x, t);
      p.positionY.setValueAtTime(y, t);
      p.positionZ.setValueAtTime(z, t);
    } else {
      p.setPosition(x, y, z);
    }
  }

  private recyclePanners(ctx: AudioContext): void {
    const now = ctx.currentTime;
    for (let i = this.activePanners.length - 1; i >= 0; i--) {
      const entry = this.activePanners[i];
      if (now >= entry.releaseTime) {
        entry.panner.disconnect();
        this.pannerPool.push(entry.panner);
        this.activePanners.splice(i, 1);
      }
    }
  }

  private acquirePanner(ctx: AudioContext): PannerNode {
    this.recyclePanners(ctx);
    return this.pannerPool.pop() ?? this.createPanner(ctx);
  }

  private spatialize(from: AudioNode, x: number, y: number, z: number, ctx: AudioContext, duration = 0.3): void {
    const panner = this.acquirePanner(ctx);
    this.positionPanner(panner, x, y, z, ctx);
    from.connect(panner);
    panner.connect(this.masterGain!);
    this.activePanners.push({ panner, releaseTime: ctx.currentTime + duration });
  }

  private thunkOsc(
    ctx: AudioContext,
    t0: number,
    freq: number,
    dur: number,
    peak: number,
    x: number,
    y: number,
    z: number,
  ): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.55, t0 + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(peak, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(env);
    this.spatialize(env, x, y, z, ctx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noiseClick(
    ctx: AudioContext,
    t0: number,
    dur: number,
    lpHz: number,
    peak: number,
    x: number,
    y: number,
    z: number,
    spatial: boolean,
  ): void {
    const buf = this.allocNoiseSlice(ctx, dur);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lpHz;
    const env = ctx.createGain();
    env.gain.setValueAtTime(peak, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(env);
    if (spatial) this.spatialize(env, x, y, z, ctx);
    else env.connect(this.masterGain!);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }
}

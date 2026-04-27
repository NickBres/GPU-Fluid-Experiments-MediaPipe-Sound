export interface Palette {
  name:              string;
  particleSlow:      [number, number, number];
  particleFast:      [number, number, number];
  particleHighlight: [number, number, number];
  dyeSlow:           [number, number, number];
  dyeFast:           [number, number, number];
  decay:             [number, number, number];
}

export const PALETTES: readonly Palette[] = [
  {
    name:              'default',
    particleSlow:      [40.4 / 300,  0 / 300, 35.0 / 300],
    particleFast:      [ 0.2 / 100, 47.8 / 100, 100 / 100],
    particleHighlight: [63.1 / 100, 92.5 / 100, 100 / 100],
    dyeSlow:           [ 2.4 / 60,   0 / 60,   5.9 / 60],
    dyeFast:           [ 0.2 / 30,  51.8 / 30, 100 / 30],
    decay:             [0.9797, 0.9494, 0.9696],
  },
  {
    name:              'fire',
    particleSlow:      [0.08, 0.01, 0.0],
    particleFast:      [1.0,  0.45, 0.0],
    particleHighlight: [1.0,  1.0,  0.6],
    dyeSlow:           [0.05, 0.01, 0.0],
    dyeFast:           [0.6,  0.25, 0.0],
    decay:             [0.990, 0.960, 0.940],
  },
  {
    name:              'ocean',
    particleSlow:      [0.0,  0.02, 0.12],
    particleFast:      [0.0,  0.55, 0.9],
    particleHighlight: [0.5,  0.9,  1.0],
    dyeSlow:           [0.0,  0.01, 0.08],
    dyeFast:           [0.0,  0.4,  0.7],
    decay:             [0.960, 0.980, 0.990],
  },
  {
    name:              'acid',
    particleSlow:      [0.0,  0.10, 0.0],
    particleFast:      [0.25, 1.0,  0.0],
    particleHighlight: [0.7,  1.0,  0.5],
    dyeSlow:           [0.0,  0.06, 0.0],
    dyeFast:           [0.15, 0.7,  0.0],
    decay:             [0.970, 0.990, 0.950],
  },
  {
    name:              'neon',
    particleSlow:      [0.15, 0.0,  0.25],
    particleFast:      [1.0,  0.0,  0.65],
    particleHighlight: [1.0,  0.6,  1.0],
    dyeSlow:           [0.1,  0.0,  0.15],
    dyeFast:           [0.7,  0.0,  0.45],
    decay:             [0.980, 0.940, 0.980],
  },
  {
    name:              'ice',
    particleSlow:      [0.02, 0.08, 0.2],
    particleFast:      [0.4,  0.85, 1.0],
    particleHighlight: [0.8,  1.0,  1.0],
    dyeSlow:           [0.01, 0.05, 0.12],
    dyeFast:           [0.25, 0.65, 0.9],
    decay:             [0.970, 0.980, 0.990],
  },
  {
    name:              'sunset',
    particleSlow:      [0.15, 0.02, 0.08],
    particleFast:      [1.0,  0.30, 0.0],
    particleHighlight: [1.0,  0.80, 0.4],
    dyeSlow:           [0.10, 0.01, 0.05],
    dyeFast:           [0.70, 0.20, 0.0],
    decay:             [0.985, 0.960, 0.975],
  },
  {
    name:              'aurora',
    particleSlow:      [0.0,  0.05, 0.08],
    particleFast:      [0.0,  0.90, 0.5],
    particleHighlight: [0.6,  1.0,  0.8],
    dyeSlow:           [0.0,  0.03, 0.05],
    dyeFast:           [0.0,  0.60, 0.35],
    decay:             [0.950, 0.985, 0.970],
  },
  {
    name:              'blood',
    particleSlow:      [0.12, 0.0,  0.0],
    particleFast:      [0.90, 0.0,  0.05],
    particleHighlight: [1.0,  0.40, 0.3],
    dyeSlow:           [0.08, 0.0,  0.0],
    dyeFast:           [0.60, 0.0,  0.03],
    decay:             [0.990, 0.950, 0.950],
  },
  {
    name:              'cosmos',
    particleSlow:      [0.02, 0.0,  0.08],
    particleFast:      [0.30, 0.10, 1.0],
    particleHighlight: [0.90, 0.80, 1.0],
    dyeSlow:           [0.01, 0.0,  0.05],
    dyeFast:           [0.20, 0.05, 0.70],
    decay:             [0.960, 0.950, 0.985],
  },
  {
    name:              'toxic',
    particleSlow:      [0.05, 0.08, 0.0],
    particleFast:      [0.70, 1.0,  0.0],
    particleHighlight: [0.90, 1.0,  0.5],
    dyeSlow:           [0.03, 0.05, 0.0],
    dyeFast:           [0.50, 0.80, 0.0],
    decay:             [0.975, 0.990, 0.940],
  },
  {
    name:              'rose',
    particleSlow:      [0.15, 0.0,  0.08],
    particleFast:      [1.0,  0.10, 0.50],
    particleHighlight: [1.0,  0.70, 0.90],
    dyeSlow:           [0.10, 0.0,  0.05],
    dyeFast:           [0.70, 0.05, 0.35],
    decay:             [0.985, 0.950, 0.975],
  },
];

// ---------------------------------------------------------------------------

type RGB = [number, number, number];

function lerp3(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export class PaletteController {
  private _idx:          number = 0;
  private _fromP:        Palette;
  private _toP:          Palette;
  private _lerpT:        number = 1.0;
  private readonly _lerpDuration = 0.5; // seconds for palette crossfade

  private _analyser:     AnalyserNode | null = null;
  private _freqData:     Uint8Array   | null = null;
  private _bassHistory:  number[]     = [];
  private _beatCooldown: number       = 0;   // seconds remaining before next auto-switch

  autoSwitch      = true;
  beatSensitivity = 1.2; // energy spike multiple over rolling average to trigger beat
  micEnabled      = false;

  // Lerped output — read these each frame and upload as uniforms
  particleSlow:      RGB;
  particleFast:      RGB;
  particleHighlight: RGB;
  dyeSlow:           RGB;
  dyeFast:           RGB;
  decay:             RGB;

  constructor() {
    const p0 = PALETTES[0];
    this._fromP = p0;
    this._toP   = p0;
    this.particleSlow      = [...p0.particleSlow]      as RGB;
    this.particleFast      = [...p0.particleFast]      as RGB;
    this.particleHighlight = [...p0.particleHighlight] as RGB;
    this.dyeSlow           = [...p0.dyeSlow]           as RGB;
    this.dyeFast           = [...p0.dyeFast]           as RGB;
    this.decay             = [...p0.decay]             as RGB;
  }

  get currentIndex(): number { return this._idx; }
  get currentName():  string { return PALETTES[this._idx].name; }

  selectByIndex(idx: number): void {
    const next = ((idx % PALETTES.length) + PALETTES.length) % PALETTES.length;
    this._fromP = this._snapshot();
    this._toP   = PALETTES[next];
    this._lerpT = 0.0;
    this._idx   = next;
  }

  selectByName(name: string): void {
    const idx = PALETTES.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
    if (idx !== -1) this.selectByIndex(idx);
  }

  async enableMic(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this._setupAudio(stream);
  }

  async enableSystemAudio(): Promise<void> {
    // Capture tab/system audio via screen share. Chrome prompts user to pick
    // a tab/window and check "Share audio". Audio-only works in Chrome 105+;
    // older versions need a dummy video track which we immediately stop.
    const gdm = navigator.mediaDevices.getDisplayMedia as (
      constraints: MediaStreamConstraints
    ) => Promise<MediaStream>;

    let stream: MediaStream;
    try {
      stream = await gdm.call(navigator.mediaDevices, { audio: true, video: false });
    } catch {
      // Fallback: request tiny video alongside audio for broader compat
      stream = await gdm.call(navigator.mediaDevices, {
        audio: true,
        video: { width: 1, height: 1 },
      });
    }

    // Drop video tracks — we only need audio
    for (const track of stream.getVideoTracks()) track.stop();

    this._setupAudio(stream);
  }

  private _setupAudio(stream: MediaStream): void {
    const ctx      = new AudioContext();
    const src      = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    src.connect(analyser);
    // Not connected to ctx.destination — audio is never echoed to speakers
    this._analyser  = analyser;
    this._freqData  = new Uint8Array(analyser.frequencyBinCount);
    this.micEnabled = true;
  }

  update(dt: number): void {
    // Advance palette crossfade
    if (this._lerpT < 1.0) {
      this._lerpT = Math.min(1.0, this._lerpT + dt / this._lerpDuration);
      const t = this._lerpT;
      this.particleSlow      = lerp3(this._fromP.particleSlow,      this._toP.particleSlow,      t);
      this.particleFast      = lerp3(this._fromP.particleFast,      this._toP.particleFast,      t);
      this.particleHighlight = lerp3(this._fromP.particleHighlight, this._toP.particleHighlight, t);
      this.dyeSlow           = lerp3(this._fromP.dyeSlow,           this._toP.dyeSlow,           t);
      this.dyeFast           = lerp3(this._fromP.dyeFast,           this._toP.dyeFast,           t);
      this.decay             = lerp3(this._fromP.decay,             this._toP.decay,             t);
    }

    // Beat detection
    this._beatCooldown = Math.max(0, this._beatCooldown - dt);
    if (!this._analyser || !this._freqData || !this.autoSwitch || this._beatCooldown > 0) return;

    this._analyser.getByteFrequencyData(this._freqData);

    // Bass bins 0-2: ~0-500Hz at 44.1kHz with fftSize=256
    const bass = (this._freqData[0] + this._freqData[1] + this._freqData[2]) / 3 / 255;

    this._bassHistory.push(bass);
    if (this._bassHistory.length > 300) this._bassHistory.shift(); // ~10s at 30fps

    if (this._bassHistory.length < 10) return; // warmup

    const avg = this._bassHistory.reduce((a, b) => a + b, 0) / this._bassHistory.length;

    if (bass > avg * this.beatSensitivity && bass > 0.08) {
      this.selectByIndex(this._idx + 1);
      this._beatCooldown = 0.5; // 500ms min between auto-switches
    }
  }

  private _snapshot(): Palette {
    return {
      name:              '_lerp',
      particleSlow:      [...this.particleSlow]      as RGB,
      particleFast:      [...this.particleFast]      as RGB,
      particleHighlight: [...this.particleHighlight] as RGB,
      dyeSlow:           [...this.dyeSlow]           as RGB,
      dyeFast:           [...this.dyeFast]           as RGB,
      decay:             [...this.decay]             as RGB,
    };
  }
}

export class PerformanceMonitor {
  fpsTooLowCallback:  ((magnitude: number) => void) | null = null;
  fpsTooHighCallback: ((magnitude: number) => void) | null = null;

  private readonly lowerBound:     number;
  private readonly upperBound:     number | null;
  private readonly thresholdMs:    number;
  private readonly ignoreLow:      number;
  private readonly ignoreHigh:     number;

  private samples:   number[] = [];
  private readonly sampleSize: number;

  private lowStart:  number | null = null;
  private highStart: number | null = null;

  constructor(
    lowerBoundFPS   = 35,
    upperBoundFPS:  number | null = null,
    thresholdMs     = 2000,
    sampleSize      = 30,
    ignoreLow       = 5,
    ignoreHigh      = 180,
  ) {
    this.lowerBound  = lowerBoundFPS;
    this.upperBound  = upperBoundFPS;
    this.thresholdMs = thresholdMs;
    this.sampleSize  = sampleSize;
    this.ignoreLow   = ignoreLow;
    this.ignoreHigh  = ignoreHigh;
  }

  recordFrameTime(dt_seconds: number): void {
    if (dt_seconds <= 0) return;
    this.recordFPS(1 / dt_seconds);
  }

  recordFPS(fps: number): void {
    if (fps < this.ignoreLow || fps > this.ignoreHigh) return;

    this.samples.push(fps);
    if (this.samples.length > this.sampleSize) this.samples.shift();

    const avg = this.fpsAverage;
    const now = performance.now();

    if (avg !== null && avg < this.lowerBound) {
      if (this.lowStart === null) this.lowStart = now;
      else if (now - this.lowStart >= this.thresholdMs && this.fpsTooLowCallback) {
        const magnitude = 1 - avg / this.lowerBound;
        this.fpsTooLowCallback(magnitude);
        this.lowStart = null;
        this.samples = [];
      }
    } else {
      this.lowStart = null;
    }

    if (this.upperBound !== null && avg !== null && avg > this.upperBound) {
      if (this.highStart === null) this.highStart = now;
      else if (now - this.highStart >= this.thresholdMs && this.fpsTooHighCallback) {
        const magnitude = avg / this.upperBound - 1;
        this.fpsTooHighCallback(magnitude);
        this.highStart = null;
        this.samples = [];
      }
    } else {
      this.highStart = null;
    }
  }

  get fpsAverage(): number | null {
    if (this.samples.length === 0) return null;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }
}

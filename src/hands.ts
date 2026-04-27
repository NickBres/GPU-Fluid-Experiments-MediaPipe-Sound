import {
  HandLandmarker,
  FilesetResolver,
} from '@mediapipe/tasks-vision';
import type { InteractionPoint } from './fluid';

// Fingertip landmark indices in MediaPipe's 21-point hand model
const FINGERTIP_INDICES = [4, 8, 12, 16, 20] as const;
const MAX_HANDS  = 2;
const MAX_POINTS = MAX_HANDS * FINGERTIP_INDICES.length; // 10

export interface HandsConfig {
  videoElement:   HTMLVideoElement;
  statusElement?: HTMLElement | null;
  numHands?:      number;
}

export class HandsTracker {
  readonly points: InteractionPoint[];

  private config:      HandsConfig;
  private landmarker:  HandLandmarker | null = null;
  private _isReady     = false;
  private lastTs       = -1;
  // Tracks whether each slot was continuously visible last frame.
  // When false → finger just appeared → zero velocity (previous = current).
  private _tracked:    boolean[] = Array(MAX_POINTS).fill(false);

  constructor(config: HandsConfig) {
    this.config = config;

    // Pre-allocate all 10 slots; inactive until a hand is detected
    this.points = Array.from({ length: MAX_POINTS }, () => ({
      current:  [0, 0] as [number, number],
      previous: [0, 0] as [number, number],
      active:   false,
    }));
  }

  get isReady(): boolean { return this._isReady; }

  async init(): Promise<void> {
    this._setStatus('Requesting camera…');

    // 1. Start camera
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width:      { ideal: 640 },
        height:     { ideal: 480 },
        facingMode: 'user',
      },
    });
    this.config.videoElement.srcObject = stream;
    await new Promise<void>(res => {
      this.config.videoElement.onloadeddata = () => res();
    });

    this._setStatus('Loading hand model…');

    // 2. Load WASM + model
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'
    );

    this.landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode:                'VIDEO',
      numHands:                   this.config.numHands ?? MAX_HANDS,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence:  0.5,
      minTrackingConfidence:      0.5,
    });

    this._isReady = true;
    this._setStatus('Hands ready — show your hands!');
  }

  // Call every animation frame BEFORE fluid.step().
  // Mutates this.points in place.
  update(): void {
    if (!this._isReady || !this.landmarker) return;

    const video = this.config.videoElement;
    if (video.readyState < video.HAVE_CURRENT_DATA) return;

    const nowMs = performance.now();
    if (nowMs <= this.lastTs) return;
    this.lastTs = nowMs;

    const result = this.landmarker.detectForVideo(video, nowMs);

    // Reset all points to inactive; clear tracking for any that disappeared
    for (let i = 0; i < MAX_POINTS; i++) {
      if (this.points[i].active) {
        // Was active — stays tracked for next frame
      } else {
        // Was already inactive last frame — clear tracked state
        this._tracked[i] = false;
      }
      this.points[i].active = false;
    }

    let pointIdx = 0;
    for (const handLandmarks of result.landmarks) {
      for (const tipIdx of FINGERTIP_INDICES) {
        if (pointIdx >= MAX_POINTS) break;

        const lm  = handLandmarks[tipIdx];
        const pt  = this.points[pointIdx];

        const newX = (1 - lm.x) * 2 - 1;
        const newY = 1 - lm.y * 2;

        if (!this._tracked[pointIdx]) {
          // First appearance this tracking session — zero velocity
          pt.previous[0] = newX;
          pt.previous[1] = newY;
          this._tracked[pointIdx] = true;
        } else {
          pt.previous[0] = pt.current[0];
          pt.previous[1] = pt.current[1];
        }

        pt.current[0] = newX;
        pt.current[1] = newY;
        pt.active = true;
        pointIdx++;
      }
      if (pointIdx >= MAX_POINTS) break;
    }
  }

  private _setStatus(msg: string): void {
    if (this.config.statusElement) {
      this.config.statusElement.textContent = msg;
    }
  }
}

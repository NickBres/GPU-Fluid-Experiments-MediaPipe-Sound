import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';

export class BodySegmenter {
  private segmenter:  ImageSegmenter | null = null;
  private _isReady    = false;
  private _maskTex:   WebGLTexture;
  private _maskW      = 0;
  private _maskH      = 0;
  private _lastTs     = -1;
  private gl:         WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    // 1×1 black default — body=0 everywhere until model loads
    this._maskTex = this._allocTexture();
    const zero = new Float32Array([0]);
    this._upload(zero, 1, 1);
  }

  get isReady():  boolean       { return this._isReady; }
  get texture():  WebGLTexture  { return this._maskTex; }

  async init(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'
    );

    this.segmenter = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite',
        delegate: 'GPU',
      },
      runningMode:          'VIDEO',
      outputCategoryMask:   false,
      outputConfidenceMasks: true,
    });

    this._isReady = true;
  }

  update(video: HTMLVideoElement): void {
    if (!this._isReady || !this.segmenter) return;
    if (video.readyState < video.HAVE_CURRENT_DATA) return;

    const nowMs = performance.now();
    if (nowMs <= this._lastTs) return;
    this._lastTs = nowMs;

    const result = this.segmenter.segmentForVideo(video, nowMs);
    if (!result.confidenceMasks || result.confidenceMasks.length === 0) return;

    const mask   = result.confidenceMasks[0];
    const w      = mask.width;
    const h      = mask.height;
    const data   = mask.getAsFloat32Array();

    this._upload(data, w, h);
    mask.close();
  }

  // ---------------------------------------------------------------------------

  private _allocTexture(): WebGLTexture {
    const { gl } = this;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  private _upload(data: Float32Array, w: number, h: number): void {
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this._maskTex);

    // UNPACK_FLIP_Y: row-0 of MediaPipe data (top of video) → UV y=1 (top of texture)
    // Result: maskUV.y == texelCoord.y (same screen-space direction)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    if (w !== this._maskW || h !== this._maskH) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, w, h, 0, gl.RED, gl.FLOAT, data);
      this._maskW = w;
      this._maskH = h;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RED, gl.FLOAT, data);
    }

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
}

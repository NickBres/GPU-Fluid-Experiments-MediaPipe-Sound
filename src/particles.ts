import {
  type PingPongTarget,
  type CompiledProgram,
  createPingPong,
  compileProgram,
  setUniform1f,
  setUniform2f,
  setUniform3f,
  setUniformTexture,
  attrLoc,
} from './webgl';

import stepVert   from './shaders/particles/step.vert?raw';
import initFrag   from './shaders/particles/init.frag?raw';
import stepFrag   from './shaders/particles/step.frag?raw';
import renderVert from './shaders/particles/render.vert?raw';
import renderFrag from './shaders/particles/render.frag?raw';

export class GPUParticles {
  readonly count: number;
  readonly particleUVs: WebGLBuffer;

  private gl:            WebGL2RenderingContext;
  private data:          PingPongTarget;
  private textureSize:   number;
  private quad:          WebGLBuffer;
  private _blankMaskTex: WebGLTexture;

  private initProg:   CompiledProgram;
  private stepProg:   CompiledProgram;
  readonly renderProg: CompiledProgram;

  constructor(gl: WebGL2RenderingContext, quad: WebGLBuffer, count: number) {
    this.gl   = gl;
    this.quad = quad;

    const size = Math.ceil(Math.sqrt(count));
    this.textureSize = size;
    this.count = size * size;

    this.data = createPingPong(gl, size, size, gl.NEAREST);

    this.initProg   = compileProgram(gl, stepVert,   initFrag);
    this.stepProg   = compileProgram(gl, stepVert,   stepFrag);
    this.renderProg = compileProgram(gl, renderVert, renderFrag);

    // 1×1 blank body mask default — bind immediately so uniform is never unset
    this._blankMaskTex = this._makeBlankMask();
    gl.useProgram(this.stepProg.program);
    setUniformTexture(gl, this.stepProg, 'bodyMask', this._blankMaskTex, 2);

    // UV buffer: each particle maps to its texel in the data texture
    this.particleUVs = this._buildUVBuffer(size);

    this.reset();
  }

  get particleDataTexture(): WebGLTexture { return this.data.read; }

  setFlowField(tex: WebGLTexture, scaleX: number, scaleY: number): void {
    const { gl } = this;
    gl.useProgram(this.stepProg.program);
    setUniformTexture(gl, this.stepProg, 'flowVelocityField', tex, 1);
    setUniform2f(gl, this.stepProg, 'flowScale', scaleX, scaleY);
  }

  setPalette(
    slow:      [number, number, number],
    fast:      [number, number, number],
    highlight: [number, number, number],
  ): void {
    const { gl } = this;
    gl.useProgram(this.renderProg.program);
    setUniform3f(gl, this.renderProg, 'uColorSlow',      slow[0],      slow[1],      slow[2]);
    setUniform3f(gl, this.renderProg, 'uColorFast',      fast[0],      fast[1],      fast[2]);
    setUniform3f(gl, this.renderProg, 'uColorHighlight', highlight[0], highlight[1], highlight[2]);
  }

  setBodyMask(tex: WebGLTexture): void {
    const { gl } = this;
    gl.useProgram(this.stepProg.program);
    setUniformTexture(gl, this.stepProg, 'bodyMask', tex, 2);
  }

  step(dt: number): void {
    const { gl } = this;
    const p = this.stepProg;
    const size = this.textureSize;

    gl.useProgram(p.program);
    setUniform1f(gl, p, 'dt', dt);
    setUniform1f(gl, p, 'dragCoefficient', 1.0);
    setUniformTexture(gl, p, 'particleData', this.data.read, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.data.writeFBO);
    gl.viewport(0, 0, size, size);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const loc = attrLoc(gl, p, 'vertexPosition');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.data.swap();
  }

  reset(): void {
    const { gl } = this;
    const p = this.initProg;
    const size = this.textureSize;

    gl.useProgram(p.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.data.writeFBO);
    gl.viewport(0, 0, size, size);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const loc = attrLoc(gl, p, 'vertexPosition');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    this.data.swap();
  }

  private _makeBlankMask(): WebGLTexture {
    const { gl } = this;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array([0]));
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  private _buildUVBuffer(size: number): WebGLBuffer {
    const { gl } = this;
    const uvs = new Float32Array(size * size * 2);
    let i = 0;
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        uvs[i++] = col / size;
        uvs[i++] = row / size;
      }
    }
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buf;
  }
}

import {
  type PingPongTarget,
  type SingleTarget,
  type CompiledProgram,
  createPingPong,
  createSingleTarget,
  resizePingPong,
  resizeSingleTarget,
  compileProgram,
  setUniform1f,
  setUniform2f,
  setUniform3f,
  setUniformBool,
  setUniformTexture,
  renderToFBO,
  drawQuad,
} from './webgl';

// Raw shader imports — Vite ?raw suffix returns string at bundle time
import fluidBaseFrag  from './shaders/fluid/fluid-base.frag?raw';
import texelSpaceVert from './shaders/fluid/texel-space.vert?raw';
import advectFrag     from './shaders/fluid/advect.frag?raw';
import divFrag        from './shaders/fluid/velocity-divergence.frag?raw';
import pressureFrag   from './shaders/fluid/pressure-solve.frag?raw';
import gradSubFrag    from './shaders/fluid/pressure-gradient-subtract.frag?raw';
import applyForcesFrag from './shaders/fluid/apply-forces.frag?raw';
import updateDyeFrag  from './shaders/fluid/update-dye.frag?raw';
import velDecayFrag      from './shaders/fluid/velocity-decay.frag?raw';
import dyeDecayFrag      from './shaders/fluid/dye-decay.frag?raw';
import bodyBoundaryFrag  from './shaders/fluid/body-boundary.frag?raw';
import geomGlsl          from './shaders/geom.glsl?raw';
import noTransformVert   from './shaders/no-transform.vert?raw';

const PREC = 'precision highp float;\n';

// Mirrors shaderblox inheritance: FluidBase → child frag
const fluidFrag = (body: string) => PREC + fluidBaseFrag + '\n' + body;
// Force/dye shaders also need geom.glsl for distanceToSegment
const interactionFrag = (body: string) => PREC + fluidBaseFrag + '\n' + geomGlsl + '\n' + body;

export interface InteractionPoint {
  current:  [number, number];
  previous: [number, number];
  active:   boolean;
}

export interface FluidConfig {
  width:            number;
  height:           number;
  cellSize:         number;
  solverIterations: number;
  linearDyeFilter:  boolean;
}

export class GPUFluid {
  width:            number;
  height:           number;
  solverIterations: number;

  readonly aspectRatio: number;

  private gl:   WebGL2RenderingContext;
  private quad: WebGLBuffer;

  private velocity:   PingPongTarget;
  private pressure:   PingPongTarget;
  private divergence: SingleTarget;
  private dye:        PingPongTarget;

  private readonly cellSize: number;
  private readonly linearDyeFilter: boolean;

  private advectProg:    CompiledProgram;
  private divProg:       CompiledProgram;
  private pressureProg:  CompiledProgram;
  private gradSubProg:   CompiledProgram;
  private forcesProg:    CompiledProgram;
  private dyeProg:       CompiledProgram;
  private velDecayProg:      CompiledProgram;
  private dyeDecayProg:      CompiledProgram;
  private bodyBoundaryProg:  CompiledProgram;
  private _bodyMaskTex:      WebGLTexture;
  private _blankMaskTex:     WebGLTexture;

  constructor(
    gl:   WebGL2RenderingContext,
    quad: WebGLBuffer,
    cfg:  FluidConfig,
  ) {
    this.gl               = gl;
    this.quad             = quad;
    this.width            = cfg.width;
    this.height           = cfg.height;
    this.cellSize         = cfg.cellSize;
    this.solverIterations = cfg.solverIterations;
    this.linearDyeFilter  = cfg.linearDyeFilter;
    this.aspectRatio      = cfg.width / cfg.height;

    const near = gl.NEAREST;
    const lin  = cfg.linearDyeFilter ? gl.LINEAR : gl.NEAREST;

    this.velocity   = createPingPong(gl, cfg.width, cfg.height, near);
    this.pressure   = createPingPong(gl, cfg.width, cfg.height, near);
    this.divergence = createSingleTarget(gl, cfg.width, cfg.height, near);
    this.dye        = createPingPong(gl, cfg.width, cfg.height, lin);

    this.advectProg   = compileProgram(gl, texelSpaceVert,  fluidFrag(advectFrag));
    this.divProg      = compileProgram(gl, texelSpaceVert,  fluidFrag(divFrag));
    this.pressureProg = compileProgram(gl, texelSpaceVert,  fluidFrag(pressureFrag));
    this.gradSubProg  = compileProgram(gl, texelSpaceVert,  fluidFrag(gradSubFrag));
    this.forcesProg   = compileProgram(gl, texelSpaceVert,  interactionFrag(applyForcesFrag));
    this.dyeProg      = compileProgram(gl, texelSpaceVert,  interactionFrag(updateDyeFrag));
    this.velDecayProg     = compileProgram(gl, noTransformVert, velDecayFrag);
    this.dyeDecayProg     = compileProgram(gl, noTransformVert, dyeDecayFrag);
    this.bodyBoundaryProg = compileProgram(gl, noTransformVert, bodyBoundaryFrag);

    // 1×1 black texture — body=0 everywhere when segmentation not ready
    this._blankMaskTex = this._makeBlankMask();
    this._bodyMaskTex  = this._blankMaskTex;

    this._initCoreUniforms();
  }

  get velocityTexture(): WebGLTexture { return this.velocity.read; }
  get dyeTexture():      WebGLTexture { return this.dye.read; }

  simToClipSpaceX(x: number): number { return x / (this.cellSize * this.aspectRatio); }
  simToClipSpaceY(y: number): number { return y / this.cellSize; }

  setBodyMask(tex: WebGLTexture): void {
    this._bodyMaskTex = tex;
  }

  setPalette(
    dyeSlow: [number, number, number],
    dyeFast: [number, number, number],
    decay:   [number, number, number],
  ): void {
    const { gl } = this;
    gl.useProgram(this.dyeProg.program);
    setUniform3f(gl, this.dyeProg, 'uDyeSlow', dyeSlow[0], dyeSlow[1], dyeSlow[2]);
    setUniform3f(gl, this.dyeProg, 'uDyeFast', dyeFast[0], dyeFast[1], dyeFast[2]);
    gl.useProgram(this.dyeDecayProg.program);
    setUniform3f(gl, this.dyeDecayProg, 'uDecay', decay[0], decay[1], decay[2]);
  }

  step(dt: number, interactions: InteractionPoint[]): void {
    const { gl } = this;

    gl.viewport(0, 0, this.width, this.height);

    this._advect(this.velocity, dt);

    // Velocity decay — one pass before fingertip loop
    this._runDecay(this.velDecayProg, 'velocity', this.velocity);

    // Force per active fingertip (ping-pong accumulates)
    for (const pt of interactions) {
      if (pt.active) this._applyForces(dt, pt);
    }

    // Body acts as solid wall — zero velocity inside silhouette
    this._applyBodyBoundary();

    this._computeDivergence();
    this._solvePressure();
    this._subtractPressureGradient();

    // Re-apply boundary after pressure solve so gradient doesn't re-introduce inward velocity
    this._applyBodyBoundary();

    // Dye decay — one pass before fingertip loop
    this._runDecay(this.dyeDecayProg, 'dye', this.dye);

    // Dye per active fingertip
    for (const pt of interactions) {
      if (pt.active) this._updateDye(dt, pt);
    }

    this._advect(this.dye, dt);
  }

  resize(width: number, height: number): void {
    const { gl } = this;
    const near = gl.NEAREST;
    const lin  = this.linearDyeFilter ? gl.LINEAR : gl.NEAREST;

    this.velocity   = resizePingPong(gl, this.velocity,   width, height, near);
    this.pressure   = resizePingPong(gl, this.pressure,   width, height, near);
    this.divergence = resizeSingleTarget(gl, this.divergence, width, height, near);
    this.dye        = resizePingPong(gl, this.dye,        width, height, lin);

    this.width  = width;
    this.height = height;

    this._initCoreUniforms();
  }

  clear(): void {
    const { gl } = this;
    const targets = [this.velocity, this.pressure, this.dye];
    for (const t of targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.readFBO);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.writeFBO);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.divergence.fbo);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // ---------------------------------------------------------------------------

  private _initCoreUniforms(): void {
    const { gl } = this;
    const ar   = this.width / this.height;
    const invW = 1 / this.width;
    const invH = 1 / this.height;
    const rdx  = 1 / this.cellSize;

    const coreProgs = [this.advectProg, this.divProg, this.pressureProg, this.gradSubProg, this.forcesProg, this.dyeProg];
    for (const p of coreProgs) {
      gl.useProgram(p.program);
      setUniform1f(gl, p, 'aspectRatio',  ar);
      setUniform2f(gl, p, 'invresolution', invW, invH);
    }

    gl.useProgram(this.advectProg.program);
    setUniform1f(gl, this.advectProg, 'rdx', rdx);

    gl.useProgram(this.divProg.program);
    setUniform1f(gl, this.divProg, 'halfrdx', 0.5 * rdx);

    gl.useProgram(this.pressureProg.program);
    setUniform1f(gl, this.pressureProg, 'alpha', -(this.cellSize * this.cellSize));

    gl.useProgram(this.gradSubProg.program);
    setUniform1f(gl, this.gradSubProg, 'halfrdx', 0.5 * rdx);

    gl.useProgram(this.forcesProg.program);
    setUniform1f(gl, this.forcesProg, 'dx', this.cellSize);

    gl.useProgram(this.dyeProg.program);
    setUniform1f(gl, this.dyeProg, 'dx', this.cellSize);
  }

  private _advect(target: PingPongTarget, dt: number): void {
    const { gl } = this;
    const p = this.advectProg;

    gl.useProgram(p.program);
    setUniform1f(gl, p, 'dt', dt);
    setUniformTexture(gl, p, 'target',   target.read,          0);
    setUniformTexture(gl, p, 'velocity', this.velocity.read,   1);

    renderToFBO(gl, p, this.quad, target.writeFBO, this.width, this.height);
    target.swap();
  }

  private _runDecay(prog: CompiledProgram, texName: string, target: PingPongTarget): void {
    const { gl } = this;
    gl.useProgram(prog.program);
    setUniformTexture(gl, prog, texName, target.read, 0);
    renderToFBO(gl, prog, this.quad, target.writeFBO, this.width, this.height);
    target.swap();
  }

  private _applyForces(dt: number, pt: InteractionPoint): void {
    const { gl } = this;
    const p = this.forcesProg;

    gl.useProgram(p.program);
    setUniform1f(gl, p, 'dt', dt);
    setUniformTexture(gl, p, 'velocity', this.velocity.read, 0);
    setUniformBool(gl, p, 'isActive', true);
    setUniform2f(gl, p, 'pointClipSpace',     pt.current[0],  pt.current[1]);
    setUniform2f(gl, p, 'lastPointClipSpace', pt.previous[0], pt.previous[1]);

    renderToFBO(gl, p, this.quad, this.velocity.writeFBO, this.width, this.height);
    this.velocity.swap();
  }

  private _computeDivergence(): void {
    const { gl } = this;
    const p = this.divProg;

    gl.useProgram(p.program);
    setUniformTexture(gl, p, 'velocity', this.velocity.read, 0);

    renderToFBO(gl, p, this.quad, this.divergence.fbo, this.width, this.height);
  }

  private _solvePressure(): void {
    const { gl } = this;
    const p = this.pressureProg;

    gl.useProgram(p.program);
    setUniformTexture(gl, p, 'divergence', this.divergence.texture, 1);

    for (let i = 0; i < this.solverIterations; i++) {
      setUniformTexture(gl, p, 'pressure', this.pressure.read, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.pressure.writeFBO);
      gl.viewport(0, 0, this.width, this.height);
      drawQuad(gl, p, this.quad);
      this.pressure.swap();
    }
  }

  private _subtractPressureGradient(): void {
    const { gl } = this;
    const p = this.gradSubProg;

    gl.useProgram(p.program);
    setUniformTexture(gl, p, 'pressure', this.pressure.read,  0);
    setUniformTexture(gl, p, 'velocity', this.velocity.read,  1);

    renderToFBO(gl, p, this.quad, this.velocity.writeFBO, this.width, this.height);
    this.velocity.swap();
  }

  private _updateDye(dt: number, pt: InteractionPoint): void {
    const { gl } = this;
    const p = this.dyeProg;

    gl.useProgram(p.program);
    setUniform1f(gl, p, 'dt', dt);
    setUniformTexture(gl, p, 'dye', this.dye.read, 0);
    setUniformBool(gl, p, 'isActive', true);
    setUniform2f(gl, p, 'pointClipSpace',     pt.current[0],  pt.current[1]);
    setUniform2f(gl, p, 'lastPointClipSpace', pt.previous[0], pt.previous[1]);

    renderToFBO(gl, p, this.quad, this.dye.writeFBO, this.width, this.height);
    this.dye.swap();
  }

  private _applyBodyBoundary(): void {
    const { gl } = this;
    const p = this.bodyBoundaryProg;

    gl.useProgram(p.program);
    setUniformTexture(gl, p, 'velocity', this.velocity.read,  0);
    setUniformTexture(gl, p, 'bodyMask', this._bodyMaskTex,   1);

    renderToFBO(gl, p, this.quad, this.velocity.writeFBO, this.width, this.height);
    this.velocity.swap();
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
}

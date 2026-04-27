export interface PingPongTarget {
  read:     WebGLTexture;
  write:    WebGLTexture;
  readFBO:  WebGLFramebuffer;
  writeFBO: WebGLFramebuffer;
  width:    number;
  height:   number;
  swap(): void;
}

export interface SingleTarget {
  texture: WebGLTexture;
  fbo:     WebGLFramebuffer;
  width:   number;
  height:  number;
}

export interface CompiledProgram {
  program:    WebGLProgram;
  uniforms:   Map<string, WebGLUniformLocation>;
  attributes: Map<string, number>;
}

export interface GL2Context {
  gl:             WebGL2RenderingContext;
  hasLinearFloat: boolean;
}

// ---------------------------------------------------------------------------

export function createWebGL2Context(canvas: HTMLCanvasElement): GL2Context {
  const gl = canvas.getContext('webgl2', { antialias: false });
  if (!gl) throw new Error('WebGL2 not supported');

  const colorBufExt = gl.getExtension('EXT_color_buffer_float');
  if (!colorBufExt) throw new Error('EXT_color_buffer_float not supported — float render targets unavailable');

  const hasLinearFloat = gl.getExtension('OES_texture_float_linear') !== null;

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.DITHER);

  return { gl, hasLinearFloat };
}

// ---------------------------------------------------------------------------

export function compileProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): CompiledProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER,   vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);

  const program = gl.createProgram()!;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Program link failed: ' + gl.getProgramInfoLog(program));
  }

  gl.deleteShader(vert);
  gl.deleteShader(frag);

  return { program, uniforms: new Map(), attributes: new Map() };
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const typeName = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    throw new Error(`${typeName} shader compile failed:\n${gl.getShaderInfoLog(shader)}\n\nSource:\n${src}`);
  }
  return shader;
}

// ---------------------------------------------------------------------------

export function uniformLoc(
  gl: WebGL2RenderingContext,
  p: CompiledProgram,
  name: string,
): WebGLUniformLocation | null {
  if (!p.uniforms.has(name)) {
    const loc = gl.getUniformLocation(p.program, name);
    if (loc) p.uniforms.set(name, loc);
    else return null;
  }
  return p.uniforms.get(name) ?? null;
}

export function attrLoc(
  gl: WebGL2RenderingContext,
  p: CompiledProgram,
  name: string,
): number {
  if (!p.attributes.has(name)) {
    const loc = gl.getAttribLocation(p.program, name);
    p.attributes.set(name, loc);
  }
  return p.attributes.get(name)!;
}

export function setUniform1f(gl: WebGL2RenderingContext, p: CompiledProgram, name: string, v: number): void {
  const loc = uniformLoc(gl, p, name);
  if (loc) gl.uniform1f(loc, v);
}

export function setUniform2f(gl: WebGL2RenderingContext, p: CompiledProgram, name: string, x: number, y: number): void {
  const loc = uniformLoc(gl, p, name);
  if (loc) gl.uniform2f(loc, x, y);
}

export function setUniform3f(gl: WebGL2RenderingContext, p: CompiledProgram, name: string, x: number, y: number, z: number): void {
  const loc = uniformLoc(gl, p, name);
  if (loc) gl.uniform3f(loc, x, y, z);
}

export function setUniform1i(gl: WebGL2RenderingContext, p: CompiledProgram, name: string, v: number): void {
  const loc = uniformLoc(gl, p, name);
  if (loc) gl.uniform1i(loc, v);
}

export function setUniformBool(gl: WebGL2RenderingContext, p: CompiledProgram, name: string, v: boolean): void {
  const loc = uniformLoc(gl, p, name);
  if (loc) gl.uniform1i(loc, v ? 1 : 0);
}

export function setUniformTexture(
  gl: WebGL2RenderingContext,
  p: CompiledProgram,
  name: string,
  texture: WebGLTexture,
  unit: number,
): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  const loc = uniformLoc(gl, p, name);
  if (loc) gl.uniform1i(loc, unit);
}

// ---------------------------------------------------------------------------

function makeFloatTexture(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  filter: number,
): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function makeFBO(gl: WebGL2RenderingContext, tex: WebGLTexture): WebGLFramebuffer {
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return fbo;
}

export function createPingPong(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  filter: number,
): PingPongTarget {
  const texA = makeFloatTexture(gl, width, height, filter);
  const texB = makeFloatTexture(gl, width, height, filter);
  const fboA = makeFBO(gl, texA);
  const fboB = makeFBO(gl, texB);

  const target: PingPongTarget = {
    read:     texA,
    write:    texB,
    readFBO:  fboA,
    writeFBO: fboB,
    width,
    height,
    swap() {
      [this.read, this.write]     = [this.write, this.read];
      [this.readFBO, this.writeFBO] = [this.writeFBO, this.readFBO];
    },
  };
  return target;
}

export function createSingleTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  filter: number,
): SingleTarget {
  const texture = makeFloatTexture(gl, width, height, filter);
  const fbo     = makeFBO(gl, texture);
  return { texture, fbo, width, height };
}

export function resizePingPong(
  gl: WebGL2RenderingContext,
  target: PingPongTarget,
  width: number,
  height: number,
  filter: number,
): PingPongTarget {
  // Delete old textures / FBOs and recreate
  gl.deleteTexture(target.read);
  gl.deleteTexture(target.write);
  gl.deleteFramebuffer(target.readFBO);
  gl.deleteFramebuffer(target.writeFBO);
  return createPingPong(gl, width, height, filter);
}

export function resizeSingleTarget(
  gl: WebGL2RenderingContext,
  target: SingleTarget,
  width: number,
  height: number,
  filter: number,
): SingleTarget {
  gl.deleteTexture(target.texture);
  gl.deleteFramebuffer(target.fbo);
  return createSingleTarget(gl, width, height, filter);
}

// ---------------------------------------------------------------------------

export function createFullscreenQuad(gl: WebGL2RenderingContext): WebGLBuffer {
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  // Two triangles forming a quad covering [0,1]x[0,1]
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0,
    1, 0,
    0, 1,
    1, 1,
  ]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return buf;
}

// Bind quad, set vertexPosition attrib, draw — caller handles program + uniforms
export function drawQuad(
  gl: WebGL2RenderingContext,
  p: CompiledProgram,
  quad: WebGLBuffer,
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  const loc = attrLoc(gl, p, 'vertexPosition');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// Full render-to-target helper
export function renderToFBO(
  gl: WebGL2RenderingContext,
  p: CompiledProgram,
  quad: WebGLBuffer,
  fbo: WebGLFramebuffer | null,
  width: number,
  height: number,
): void {
  gl.useProgram(p.program);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.viewport(0, 0, width, height);
  drawQuad(gl, p, quad);
}

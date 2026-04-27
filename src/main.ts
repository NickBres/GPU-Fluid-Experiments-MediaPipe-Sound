import { createWebGL2Context, createFullscreenQuad, compileProgram, setUniformTexture, attrLoc } from './webgl';
import { GPUFluid } from './fluid';
import { GPUParticles } from './particles';
import { HandsTracker } from './hands';
import { BodySegmenter } from './segmentation';
import { PerformanceMonitor } from './performance';
import { PaletteController } from './palette';

import noTransformVert from './shaders/no-transform.vert?raw';
import screenFrag      from './shaders/screen.frag?raw';

// ---------------------------------------------------------------------------
// Quality presets — port of SimulationQuality enum
// ---------------------------------------------------------------------------

const QUALITY_PRESETS = {
  UltraHigh: { particles: 1 << 20, fluidScale: 1 / 2,  iterations: 30 },
  High:      { particles: 1 << 20, fluidScale: 1 / 4,  iterations: 20 },
  Medium:    { particles: 1 << 18, fluidScale: 1 / 4,  iterations: 18 },
  Low:       { particles: 1 << 16, fluidScale: 1 / 5,  iterations: 14 },
  UltraLow:  { particles: 1 << 14, fluidScale: 1 / 6,  iterations: 12 },
} as const;

type QualityKey = keyof typeof QUALITY_PRESETS;
const QUALITY_KEYS = Object.keys(QUALITY_PRESETS) as QualityKey[];

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const canvas   = document.getElementById('canvas')   as HTMLCanvasElement;
  const video    = document.getElementById('video')    as HTMLVideoElement;
  const statusEl = document.getElementById('status')   as HTMLDivElement;

  // Fill canvases to window
  function resizeCanvas(): void {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();

  // ---------------------------------------------------------------------------
  // WebGL2
  // ---------------------------------------------------------------------------
  const { gl, hasLinearFloat } = createWebGL2Context(canvas);
  const quad = createFullscreenQuad(gl);

  // Screen-blit shader (renders a texture to the canvas)
  const screenProg = compileProgram(gl, noTransformVert, 'precision highp float;\n' + screenFrag);

  // ---------------------------------------------------------------------------
  // Quality
  // ---------------------------------------------------------------------------
  let qualityIdx = 2; // default: Medium
  const urlQ = new URLSearchParams(location.search).get('q');
  if (urlQ) {
    const idx = QUALITY_KEYS.findIndex(k => k.toLowerCase() === urlQ.toLowerCase());
    if (idx !== -1) qualityIdx = idx;
  }

  const getPreset = () => QUALITY_PRESETS[QUALITY_KEYS[qualityIdx]];

  // ---------------------------------------------------------------------------
  // Palette + audio
  // ---------------------------------------------------------------------------
  const palette = new PaletteController();

  const urlPalette = new URLSearchParams(location.search).get('palette');
  if (urlPalette) palette.selectByName(urlPalette);

  // ---------------------------------------------------------------------------
  // Fluid
  // ---------------------------------------------------------------------------
  let preset = getPreset();

  function fluidSize() {
    return {
      w: Math.round(canvas.width  * preset.fluidScale),
      h: Math.round(canvas.height * preset.fluidScale),
    };
  }

  const { w: fw, h: fh } = fluidSize();
  const fluid = new GPUFluid(gl, quad, {
    width:            fw,
    height:           fh,
    cellSize:         32,
    solverIterations: preset.iterations,
    linearDyeFilter:  hasLinearFloat,
  });

  // ---------------------------------------------------------------------------
  // Particles
  // ---------------------------------------------------------------------------
  const particles = new GPUParticles(gl, quad, preset.particles);
  particles.setFlowField(
    fluid.velocityTexture,
    fluid.simToClipSpaceX(1),
    fluid.simToClipSpaceY(1),
  );

  // ---------------------------------------------------------------------------
  // Hands
  // ---------------------------------------------------------------------------
  const hands = new HandsTracker({ videoElement: video, statusElement: statusEl });
  hands.init().catch(err => {
    console.warn('Hand tracking unavailable:', err);
    statusEl.textContent = 'Camera unavailable — use mouse to interact';
    enableMouseFallback();
  });

  // ---------------------------------------------------------------------------
  // Body segmentation
  // ---------------------------------------------------------------------------
  const segmentation = new BodySegmenter(gl);
  segmentation.init().catch(err => {
    console.warn('Body segmentation unavailable:', err);
  });

  // ---------------------------------------------------------------------------
  // Mouse fallback (if camera denied or unavailable)
  // ---------------------------------------------------------------------------
  const mousePt = { current: [0, 0] as [number, number], previous: [0, 0] as [number, number], active: false };

  function enableMouseFallback(): void {
    window.addEventListener('mousemove', e => {
      mousePt.previous[0] = mousePt.current[0];
      mousePt.previous[1] = mousePt.current[1];
      mousePt.current[0]  = (e.clientX / canvas.width)  * 2 - 1;
      mousePt.current[1]  = 1 - (e.clientY / canvas.height) * 2;
    });
    window.addEventListener('mousedown',  () => { mousePt.active = true;  });
    window.addEventListener('mouseup',    () => { mousePt.active = false; });
    window.addEventListener('touchstart', e => {
      const t = e.touches[0];
      mousePt.current[0]  = (t.clientX / canvas.width)  * 2 - 1;
      mousePt.current[1]  = 1 - (t.clientY / canvas.height) * 2;
      mousePt.previous[0] = mousePt.current[0];
      mousePt.previous[1] = mousePt.current[1];
      mousePt.active = true;
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchmove', e => {
      const t = e.touches[0];
      mousePt.previous[0] = mousePt.current[0];
      mousePt.previous[1] = mousePt.current[1];
      mousePt.current[0]  = (t.clientX / canvas.width)  * 2 - 1;
      mousePt.current[1]  = 1 - (t.clientY / canvas.height) * 2;
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchend', () => { mousePt.active = false; });
  }

  // ---------------------------------------------------------------------------
  // Performance monitor + quality auto-downgrade
  // ---------------------------------------------------------------------------
  const perfMon = new PerformanceMonitor(35, null, 2000);
  perfMon.fpsTooLowCallback = () => {
    const maxIdx = QUALITY_KEYS.length - 1;
    if (qualityIdx >= maxIdx) return;
    qualityIdx++;
    preset = getPreset();
    fluid.solverIterations = preset.iterations;
    const { w, h } = fluidSize();
    fluid.resize(w, h);
    statusEl.textContent = `Quality: ${QUALITY_KEYS[qualityIdx]}`;
    perfMon.fpsTooLowCallback = null; // fire once then stop auto-adjusting
  };

  // ---------------------------------------------------------------------------
  // Render state
  // ---------------------------------------------------------------------------
  let renderParticles = true;
  let renderFluid     = true;
  let lastTime        = performance.now() / 1000;
  let mouseFallback   = false;

  // Push initial palette uniforms so shaders aren't zero on first frame
  particles.setPalette(palette.particleSlow, palette.particleFast, palette.particleHighlight);
  fluid.setPalette(palette.dyeSlow, palette.dyeFast, palette.decay);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------
  window.addEventListener('keyup', e => {
    switch (e.key.toUpperCase()) {
      case 'R': particles.reset(); fluid.clear(); break;
      case 'P': renderParticles = !renderParticles; break;
      case 'D': renderFluid = !renderFluid; break;
      case 'S': fluid.clear(); break;
      // Palette: 1-6 select by index, B toggle beat auto-switch, M enable mic
      case '1': case '2': case '3': case '4': case '5': case '6':
        palette.selectByIndex(parseInt(e.key) - 1);
        statusEl.textContent = `Palette: ${palette.currentName}`;
        break;
      case 'B':
        palette.autoSwitch = !palette.autoSwitch;
        statusEl.textContent = `Beat auto-switch: ${palette.autoSwitch ? 'ON' : 'OFF'}`;
        break;
      case 'M':
        if (!palette.micEnabled) {
          palette.enableSystemAudio()
            .then(() => { statusEl.textContent = 'System audio active — beat detection on'; })
            .catch(() => { statusEl.textContent = 'Audio capture denied or unsupported'; });
        }
        break;
      case 'N':
        if (!palette.micEnabled) {
          palette.enableMic()
            .then(() => { statusEl.textContent = 'Mic active — beat detection on'; })
            .catch(() => { statusEl.textContent = 'Mic permission denied'; });
        }
        break;
    }
  });

  window.addEventListener('resize', () => {
    resizeCanvas();
    const { w, h } = fluidSize();
    fluid.resize(w, h);
    particles.setFlowField(
      fluid.velocityTexture,
      fluid.simToClipSpaceX(1),
      fluid.simToClipSpaceY(1),
    );
  });

  // ---------------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------------
  function frame(): void {
    const now = performance.now() / 1000;
    const dt  = Math.min(now - lastTime, 0.05);
    lastTime  = now;

    perfMon.recordFrameTime(dt);

    // Palette update (lerp + beat detection)
    palette.update(dt);
    particles.setPalette(palette.particleSlow, palette.particleFast, palette.particleHighlight);
    fluid.setPalette(palette.dyeSlow, palette.dyeFast, palette.decay);

    // Gather interaction points
    hands.update();
    segmentation.update(video);
    const interactions = hands.isReady ? hands.points : [mousePt];

    // Push body mask into fluid + particles
    const maskTex = segmentation.texture;
    fluid.setBodyMask(maskTex);
    particles.setBodyMask(maskTex);

    // Simulation
    fluid.step(dt, interactions);

    particles.setFlowField(
      fluid.velocityTexture,
      fluid.simToClipSpaceX(1),
      fluid.simToClipSpaceY(1),
    );
    if (renderParticles) particles.step(dt);

    // ---------------------------------------------------------------------------
    // Render to canvas
    // ---------------------------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.SRC_ALPHA);
    gl.blendEquation(gl.FUNC_ADD);

    // Draw particles as GL_POINTS
    if (renderParticles) {
      const p = particles.renderProg;
      gl.useProgram(p.program);
      setUniformTexture(gl, p, 'particleData', particles.particleDataTexture, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, particles.particleUVs);
      const uvLoc = attrLoc(gl, p, 'particleUV');
      gl.enableVertexAttribArray(uvLoc);
      gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, particles.count);
    }

    // Draw dye texture over particles
    if (renderFluid) {
      gl.useProgram(screenProg.program);
      setUniformTexture(gl, screenProg, 'texture', fluid.dyeTexture, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      const posLoc = attrLoc(gl, screenProg, 'vertexPosition');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    gl.disable(gl.BLEND);

    if (hands.isReady) {
      const activeCount = hands.points.filter(p => p.active).length;
      statusEl.textContent = activeCount > 0
        ? `${activeCount} fingertip${activeCount > 1 ? 's' : ''} detected`
        : 'Show your hands…';
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  // Suppress unused variable lint
  void mouseFallback;
}

main().catch(err => {
  const status = document.getElementById('status');
  if (status) status.textContent = String(err);
  console.error(err);
});

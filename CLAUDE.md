# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

Requires Haxe + Lime toolchain (`haxelib install lime`, `haxelib install shaderblox`, `haxelib install gltoolbox`).

```bash
lime build html5          # Build for WebGL/browser → Export/html5/
lime test html5           # Build and launch in browser
lime build windows        # Desktop build (OpenGL)
lime build linux
```

No test suite — manual testing only via browser or desktop build.

## Architecture

GPU fluid simulation using Navier-Stokes equations, compiled from Haxe to WebGL via Lime.

**Data flow each frame:**
1. Mouse input → `MouseForce` / `MouseDye` shaders inject velocity & dye into GPU textures
2. `GPUFluid.step()` — multi-pass shader pipeline: advect velocity → compute divergence → Jacobi pressure solve (N iterations) → subtract pressure gradient → advect dye
3. `GPUParticles.step()` — advect particle positions through velocity field
4. Render particles + dye to screen

**Render-to-texture pipeline:** All simulation state lives in double-buffered GPU textures (`RenderTarget2Phase` from gltoolbox). Each pass reads from one buffer and writes to the other.

**Key files:**
- [Source/Main.hx](Source/Main.hx) — entry point, event handling, inline shaders (`ScreenTexture`, `ColorParticleMotion`, `MouseDye`, `MouseForce`), render loop
- [Source/GPUFluid.hx](Source/GPUFluid.hx) — fluid simulation: velocity, pressure, dye textures + shader pass sequencing
- [Source/GPUParticles.hx](Source/GPUParticles.hx) — GPU particle system advected through fluid velocity field
- [Source/PerformanceMonitor.hx](Source/PerformanceMonitor.hx) — rolling 30-frame FPS stats; auto-downgrades quality if FPS < 30 for 3s
- [Source/shaders/glsl/fluid/](Source/shaders/glsl/fluid/) — GLSL fragment shaders for each simulation pass

**Shaders in Haxe source:** Inline shaders use `@:vert` / `@:frag` annotations via shaderblox. External GLSL lives in `Source/shaders/glsl/`.

**Quality settings:** URL params `?q=ultralow|low|medium|high|ultrahigh` control particle count, fluid resolution, and solver iteration count. Parsed in [Source/js/Web.hx](Source/js/Web.hx).

## Known Gotchas

- Never normalize a zero vector in shaders — causes GPU-specific rendering artifacts
- Texture lookups must be inside `void main()` — not all GPUs support lookups in helper functions
- `OES_texture_float_linear` may be absent on iOS WebGL; bilinear fallback not yet implemented (see NOTES.md)
- Particle density issues can cause apparent performance degradation — GPU core contention on texture lookups, not a true memory leak

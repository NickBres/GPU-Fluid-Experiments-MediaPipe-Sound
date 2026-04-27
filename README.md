# GPU Fluid + MediaPipe + Sound

GPU fluid simulation with real-time hand tracking and audio-reactive palettes — runs in the browser, no install needed.

**[Original project by @haxiomic](https://github.com/haxiomic/GPU-Fluid-Experiments)**

---

## What's new in this fork

- Full **TypeScript + WebGL2** rewrite (original was Haxe/Lime)
- **MediaPipe hand tracking** — fingertips drive fluid forces via webcam
- **Body segmentation** — your silhouette interacts with the fluid
- **Audio-reactive palettes** — beat detection via mic or system audio
- **Mouse/touch fallback** when camera is unavailable
- Built with **Vite**, no toolchain setup needed

## Run locally

```bash
npm install
npm run dev
```

Open `https://localhost:5173` — HTTPS required for camera access.

## Controls

| Key | Action |
|-----|--------|
| `1`–`6` | Switch color palette |
| `M` | Enable microphone beat detection |
| `N` | Enable system audio beat detection |
| `B` | Toggle auto palette switching on beat |
| `R` | Reset particles + fluid |
| `P` | Toggle particle rendering |
| `D` | Toggle dye rendering |
| `S` | Clear dye |

URL params: `?q=ultralow|low|medium|high|ultrahigh` — set quality preset.

## Credits

Original GPU fluid simulation by [George Corney (@haxiomic)](https://github.com/haxiomic/GPU-Fluid-Experiments) — Navier-Stokes solver, double-buffered render-to-texture pipeline, particle system, quality presets. This fork rewrites the rendering engine in TypeScript/WebGL2 and adds hand tracking, body segmentation, and audio reactivity on top of those ideas.

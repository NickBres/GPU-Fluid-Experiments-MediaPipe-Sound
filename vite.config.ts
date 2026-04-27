import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const isGHPages = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  base: isGHPages ? '/GPU-Fluid-Experiments-MediaPipe-Sound/' : '/',
  plugins: [basicSsl()],
  assetsInclude: ['**/*.task', '**/*.tflite'],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'es2020',
  },
});

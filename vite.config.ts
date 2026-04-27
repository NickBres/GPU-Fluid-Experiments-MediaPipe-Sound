import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
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

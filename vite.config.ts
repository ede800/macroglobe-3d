import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const stubs = fileURLToPath(new URL('./src/lib/stubs.ts', import.meta.url));

// base: './' makes every asset URL relative, so the build works on any
// GitHub Pages path (https://<user>.github.io/<any-repo-name>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    // react-globe.gl pulls in the WebGPU renderer, TSL and h3-js for layers this app never uses
    alias: [
      { find: /^three\/webgpu$/, replacement: stubs },
      { find: /^three\/tsl$/, replacement: stubs },
      { find: /^h3-js$/, replacement: stubs },
    ],
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          globe: ['react-globe.gl'],
        },
      },
    },
  },
});

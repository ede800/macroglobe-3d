import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' makes every asset URL relative, so the build works on any
// GitHub Pages path (https://<user>.github.io/<any-repo-name>/).
export default defineConfig({
  base: './',
  plugins: [react()],
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

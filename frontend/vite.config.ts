import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname),
  plugins: [react()],
  base: '/app/',
  build: {
    outDir: resolve(__dirname, '..', 'public', 'app'),
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
});

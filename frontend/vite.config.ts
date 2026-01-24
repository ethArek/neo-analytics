import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

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

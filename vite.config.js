import { defineConfig } from 'vite';

export default defineConfig({
  // The existing application is intentionally kept in its original directory.
  root: 'nova',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});

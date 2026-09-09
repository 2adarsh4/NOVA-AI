import { defineConfig } from 'vite';

export default defineConfig({
  // Keep the established browser application directory for compatibility.
  root: 'nova',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});

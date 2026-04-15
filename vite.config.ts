import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true
  }
});

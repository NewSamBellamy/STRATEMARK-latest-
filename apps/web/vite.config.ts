/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath, URL } from 'node:url';

// SINGLEFILE=1 inlines all JS/CSS into one index.html — used to publish a
// self-contained public demo (works with the user's own key, client-side).
const singleFile = process.env.SINGLEFILE === '1';

export default defineConfig({
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  // Relative asset base so the built bundle loads under Electron via file:// (spec: Electron-ready).
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Allow importing the workspace packages' TS source from the monorepo root.
    fs: { allow: ['../..'] },
  },
  // Workspace packages export raw .ts; let Vite transform them instead of pre-bundling.
  optimizeDeps: { exclude: ['@mi/contracts', '@mi/mocks', '@mi/research'] },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/**/*.stories.tsx',
      ],
    },
  },
});

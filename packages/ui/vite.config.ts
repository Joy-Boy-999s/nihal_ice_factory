import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiBaseUrl = env['VITE_API_URL'] ?? 'http://localhost:3000';

  // Absolute paths to browser-safe stubs for server-only NestJS modules.
  // These libs use Node.js APIs (class-transformer/storage, reflect-metadata, etc.)
  // that don't exist in the browser — the frontend only needs their TS types.
  const stubs = (name: string) =>
    path.resolve(__dirname, `src/stubs/${name}.ts`);

  return {
    root: __dirname,
    cacheDir: '../../node_modules/.vite/packages/ui',
    server: {
      port: 4200,
      host: 'localhost',
    },
    preview: {
      port: 4300,
      host: 'localhost',
    },
    plugins: [react()],
    define: {
      __API_BASE_URL__: JSON.stringify(apiBaseUrl),
    },
    resolve: {
      alias: {
        // ── Monorepo libs ───────────────────────────────────────────────────
        '@nihal-ice-factory/shared-services': path.resolve(
          __dirname,
          '../../libs/shared-services/src/index.ts'
        ),
        '@nihal-ice-factory/shared-models': path.resolve(
          __dirname,
          '../../libs/shared-models/src/index.ts'
        ),
        // ── NestJS / server-only stubs ──────────────────────────────────────
        // These must come BEFORE any catch-all rule.
        'class-transformer/storage': stubs('class-transformer-storage'),
        '@nestjs/swagger':           stubs('nestjs-swagger'),
        '@nestjs/mapped-types':      stubs('nestjs-mapped-types'),
      },
    },
    optimizeDeps: {
      // Exclude packages that use Node.js APIs so Vite doesn't try to pre-bundle them.
      exclude: ['@nestjs/mapped-types', '@nestjs/swagger'],
    },
    build: {
      outDir: '../../dist/packages/ui',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: {
        transformMixedEsModules: true,
      },
      rollupOptions: {
        external: [],
      },
    },
  };
});

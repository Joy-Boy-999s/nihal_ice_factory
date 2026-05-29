import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const apiBaseUrl = env['VITE_API_URL'] ?? 'http://localhost:3000';

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
        '@nihal-ice-factory/shared-services': path.resolve(
          __dirname,
          '../../libs/shared-services/src/index.ts'
        ),
        '@nihal-ice-factory/shared-models': path.resolve(
          __dirname,
          '../../libs/shared-models/src/index.ts'
        ),
      },
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

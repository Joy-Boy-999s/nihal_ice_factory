import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // Old Nx-generated placeholder specs predate this setup and use jest globals
    exclude: ['src/app/app.controller.spec.ts', 'src/app/app.service.spec.ts', '**/node_modules/**'],
  },
  esbuild: {
    target: 'es2022',
    // NestJS/TypeORM decorators
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: false,
      },
    },
  },
});

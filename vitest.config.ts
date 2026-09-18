import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Testes de integração compartilham um banco: rodar em série evita
    // interferência entre eles.
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // `server-only` lança por design fora do runtime do Next; nos testes
      // substituímos por um módulo vazio para poder exercitar os serviços.
      'server-only': path.resolve(__dirname, './tests/support/server-only-stub.ts'),
    },
  },
});

import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './test'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    silent: true,
  },
  plugins: [],
});

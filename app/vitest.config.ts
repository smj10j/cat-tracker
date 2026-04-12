import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    // Screen smoke tests run in jsdom; pure function tests stay in node
    environmentMatchGlobs: [
      ['__tests__/screens/**', 'jsdom'],
    ],
    setupFiles: ['__tests__/screens/setup.ts'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
      // Stub native-only packages that Vite can't resolve in tests
      '@react-native-community/datetimepicker': path.resolve(__dirname, '__tests__/screens/__mocks__/datetimepicker.ts'),
    },
  },
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'expo-secure-store': fileURLToPath(new URL('./tests/stubs/expo-secure-store.ts', import.meta.url)),
      'react-native': fileURLToPath(new URL('./tests/stubs/react-native.ts', import.meta.url)),
      'react-native-url-polyfill/auto': fileURLToPath(
        new URL('./tests/stubs/react-native-url-polyfill-auto.ts', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'node',
  },
});

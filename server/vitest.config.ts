import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    watch: false,
    // Only satisfies src/config's eager `config = loadConfig(process.env)`
    // parse at import time. Individual tests exercise loadConfig() directly
    // with their own env records — these two values are never read by tests
    // that talk to a database (those always go through tests/helpers/db.ts's
    // throwaway temp-file db, never config.DB_PATH).
    env: {
      DB_PATH: './data/test-placeholder-unused.sqlite',
      JWT_SECRET: 'test-secret-at-least-32-characters-long',
    },
  },
});

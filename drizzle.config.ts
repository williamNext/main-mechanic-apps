import { defineConfig } from 'drizzle-kit';

const dbPath = process.env.DB_PATH ?? './data/dev.sqlite';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: dbPath,
  },
});

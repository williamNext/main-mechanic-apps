import { buildApp } from './app.js';
import { config } from './config/index.js';
import { createDb } from './db/client.js';
import { runMigrations } from './db/migrate.js';

const { db, connection } = createDb(config.DB_PATH);
runMigrations(db);

const app = buildApp(db, connection);

app
  .listen({ port: config.PORT, host: '0.0.0.0' })
  .then((address) => {
    console.log(`Server listening at ${address}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback to local file if no URL is provided
const localDbPath = path.resolve(__dirname, '../../data.db');
const dbUrl = process.env.DATABASE_URL || process.env.DB_URL || `file:${localDbPath}`;
const authToken = process.env.DB_AUTH_TOKEN;

if (dbUrl.startsWith('file:')) {
  console.log(`[DB] Using local SQLite database at: ${dbUrl}`);
} else {
  console.log(`[DB] Connecting to remote database...`);
}

const db = createClient({
  url: dbUrl,
  authToken: authToken,
});

export default db;

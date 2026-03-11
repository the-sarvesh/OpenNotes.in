import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback to local file if no DB_URL is provided
const localDbPath = path.resolve(__dirname, '../../data.db');
const dbUrl = process.env.DB_URL || `file:${localDbPath}`;
const authToken = process.env.DB_AUTH_TOKEN;

const db = createClient({
  url: dbUrl,
  authToken: authToken,
});

export default db;

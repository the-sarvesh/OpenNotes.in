import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the directory one level up from src
const dbPath = path.resolve(__dirname, '../../data.db');

const db = createClient({
  url: `file:${dbPath}`,
});

export default db;

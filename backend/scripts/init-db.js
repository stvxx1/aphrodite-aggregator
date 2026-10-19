import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createPool } from '../src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = createPool();

async function initDB() {
  console.log('Initializing database...');
  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(schema);
    console.log('Database schema created successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

initDB();

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'u0_a403',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'aphrodite',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

app.use(cors());
app.use(express.json());

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Aphrodite API is running' });
});

// Fetch videos (with optional duration filter and search text)
app.get('/api/videos', async (req, res) => {
  try {
    const { minDuration = 5, query = '' } = req.query;
    const minDurationSecs = parseInt(minDuration) * 60;
    
    let sql = `
      SELECT v.*, c.name as channel_name
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      WHERE v.duration >= $1
    `;
    
    const params = [minDurationSecs];

    // If query exists, utilize GIN index for full text search
    if (query) {
       sql += ` AND v.search_vector @@ plainto_tsquery('english', $2)`;
       params.push(query);
    }
    
    sql += ` ORDER BY v.created_at DESC LIMIT 50`;

    const result = await pool.query(sql, params);
    
    // Convert duration to minutes for frontend ease
    const formattedVideos = result.rows.map(v => ({
      ...v,
      durationMinutes: Math.floor(v.duration / 60)
    }));

    res.json(formattedVideos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

app.get('/api/models', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM models ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});

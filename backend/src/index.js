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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Fetch videos
app.get('/api/videos', async (req, res) => {
  try {
    const { minDuration = 5, query = '', tag = '' } = req.query;
    const minDurationSecs = parseInt(minDuration) * 60;
    
    let sql = `
      SELECT DISTINCT v.*, c.name as channel_name
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
      LEFT JOIN video_tags vt ON vt.video_id = v.id
      LEFT JOIN tags t ON t.id = vt.tag_id
      WHERE v.duration >= $1
    `;
    
    const params = [minDurationSecs];
    let paramIndex = 2;

    if (query) {
       sql += ` AND v.search_vector @@ plainto_tsquery('english', $${paramIndex})`;
       params.push(query);
       paramIndex++;
    }

    if (tag) {
       sql += ` AND t.name ILIKE $${paramIndex}`;
       params.push(`%${tag}%`);
       paramIndex++;
    }
    
    sql += ` ORDER BY v.created_at DESC LIMIT 50`;

    const result = await pool.query(sql, params);
    
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

app.get('/api/tags', async (req, res) => {
  try {
    // Get top 20 most used tags
    const sql = `
      SELECT t.name, COUNT(vt.video_id) as count
      FROM tags t
      JOIN video_tags vt ON t.id = vt.tag_id
      GROUP BY t.name
      ORDER BY count DESC
      LIMIT 20
    `;
    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});

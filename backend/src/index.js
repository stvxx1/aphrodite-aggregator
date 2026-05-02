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

let tagCache = null;
let tagCacheTime = 0;

// Fetch videos
app.get('/api/videos', async (req, res) => {
  try {
    const { minDuration = 5, query = '', tag = '', sort = 'new' } = req.query;
    const minDurationSecs = parseInt(minDuration) * 60;
    
    let sql = `
      SELECT DISTINCT v.*, c.name as channel_name
      FROM videos v
      LEFT JOIN channels c ON v.channel_id = c.id
    `;
    
    if (tag) {
        sql += ` INNER JOIN video_tags vt ON vt.video_id = v.id INNER JOIN tags t ON t.id = vt.tag_id AND t.name = $2`;
    }

    sql += ` WHERE v.duration >= $1`;
    
    const params = [minDurationSecs];
    let paramIndex = tag ? 3 : 2;

    if (tag) {
        params.push(tag);
    }

    if (query) {
       sql += ` AND v.search_vector @@ plainto_tsquery('english', $${paramIndex})`;
       params.push(query);
       paramIndex++;
    }
    
    if (sort === 'best') {
        sql += ` ORDER BY v.duration DESC LIMIT 50`; // Mocking best by duration for now, since we don't have views stored cleanly yet
    } else {
        sql += ` ORDER BY v.created_at DESC LIMIT 50`;
    }

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
    // 5 minute cache
    if (tagCache && (Date.now() - tagCacheTime < 300000)) {
        return res.json(tagCache);
    }

    const sql = `
      SELECT t.name, COUNT(vt.video_id) as count
      FROM tags t
      JOIN video_tags vt ON t.id = vt.tag_id
      GROUP BY t.name
      ORDER BY count DESC
      LIMIT 20
    `;
    const result = await pool.query(sql);
    tagCache = result.rows;
    tagCacheTime = Date.now();

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Extra endpoints for routing tabs
app.get('/api/channels', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM channels ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});

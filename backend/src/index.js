import express from 'express';
import cors from 'cors';
import { createPool } from './db.js';

const app = express();
const port = process.env.PORT || 3001;

const pool = createPool();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

let tagCache = null;
let tagCacheTime = 0;

const VIDEO_COLUMNS = `v.id, v.title, v.description, v.video_url, v.preview_url,
  v.duration, v.channel_id, v.created_at, v.published_at, c.name AS channel_name`;
const MAX_LIMIT = 100;

// Fetch videos
app.get('/api/videos', async (req, res) => {
  try {
    const { query = '', tag = '', sort = 'new' } = req.query;
    // Query params can be arrays/objects (?tag=a&tag=b); only accept plain strings.
    if (typeof query !== 'string' || typeof tag !== 'string') {
      return res.status(400).json({ error: 'query and tag must be strings' });
    }

    const minDuration = Number(req.query.minDuration ?? 5);
    if (!Number.isFinite(minDuration) || minDuration < 0) {
      return res.status(400).json({ error: 'minDuration must be a non-negative number of minutes' });
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), MAX_LIMIT);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    // video_tags is keyed on (video_id, tag_id) and tags.name is UNIQUE, so the tag
    // join yields at most one row per video; no DISTINCT needed.
    const params = [Math.round(minDuration * 60)];
    let sql = `SELECT ${VIDEO_COLUMNS} FROM videos v LEFT JOIN channels c ON v.channel_id = c.id`;

    if (tag) {
      params.push(tag);
      sql += ` INNER JOIN video_tags vt ON vt.video_id = v.id
               INNER JOIN tags t ON t.id = vt.tag_id AND t.name = $${params.length}`;
    }

    sql += ` WHERE v.duration >= $1`;

    if (query) {
      params.push(query);
      sql += ` AND v.search_vector @@ plainto_tsquery('english', $${params.length})`;
    }

    // Mocking best by duration for now, since we don't have views stored cleanly yet
    const order = sort === 'best' ? 'v.duration DESC' : 'v.created_at DESC';
    // id as tiebreaker keeps pagination stable
    sql += ` ORDER BY ${order}, v.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

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
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

const server = app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
  });
}

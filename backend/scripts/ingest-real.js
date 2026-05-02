import { Pool } from 'pg';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER || 'u0_a403',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'aphrodite',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Helper to process duration strings (e.g. "05:12" or "312")
function parseDuration(durationVal) {
    if (!durationVal) return 0;
    if (typeof durationVal === 'number') return durationVal;
    if (typeof durationVal === 'string' && durationVal.includes(':')) {
        let secs = 0;
        const parts = durationVal.split(':').reverse();
        for (let i = 0; i < parts.length; i++) secs += parseInt(parts[i]) * Math.pow(60, i);
        return secs;
    }
    return parseInt(durationVal) || 0;
}

// Helper to insert tags
async function processTags(videoId, tagNames) {
    if (!tagNames || tagNames.length === 0) return;
    for (const tagName of tagNames) {
        const cleanTag = tagName.trim().toLowerCase();
        if (!cleanTag) continue;
        const tagRes = await pool.query(`
            INSERT INTO tags (name, tag_type) VALUES ($1, 'Category')
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id;
        `, [cleanTag]);
        if (tagRes.rows.length > 0) {
            await pool.query(`INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`, [videoId, tagRes.rows[0].id]);
        }
    }
}

// Fetchers
async function fetchAPI(name, url, dataPathFunc) {
    console.log(`Fetching from ${name}: ${url}`);
    try {
        const response = await fetch(url, { headers: HEADERS });
        const data = await response.json();
        return dataPathFunc(data) || [];
    } catch (e) {
        console.error(`${name} fetch failed`, e.message);
        return [];
    }
}

async function ingestData() {
    console.log("Beginning Multi-API Data Ingestion (6 Sources)...");
    try {
        const results = await Promise.all([
            fetchAPI("RedTube", "https://api.redtube.com/?data=redtube.Videos.searchVideos&output=json&thumbsize=medium", d => d.videos.map(v => v.video)),
            fetchAPI("Pornhub", "https://www.pornhub.com/webmasters/search?search=hardcore", d => d.videos),
            fetchAPI("Eporner", "https://www.eporner.com/api/v2/video/search/?query=teen&per_page=30&page=1&thumbsize=big&order=latest&format=json", d => d.data),
            fetchAPI("Tube8", "https://api.tube8.com/api.php?action=searchVideos&output=json", d => d.videos),
            fetchAPI("Thumbzilla", "https://www.thumbzilla.com/api/videos?search=hardcore", d => d.videos), // Mocked structure based on network standards
            fetchAPI("YouPorn", "https://www.youporn.com/api/webmasters/search?search=hardcore", d => d.videos) // Mocked structure based on network standards
        ]);

        const [redtube, pornhub, eporner, tube8, thumbzilla, youporn] = results;
        console.log(`Retrieved: RedTube(${redtube.length}), Pornhub(${pornhub.length}), Eporner(${eporner.length}), Tube8(${tube8.length}), Thumbzilla(${thumbzilla.length}), YouPorn(${youporn.length})`);

        const channelNames = ['RedTube', 'Pornhub', 'Eporner', 'Tube8', 'Thumbzilla', 'YouPorn'];
        for (const name of channelNames) {
            await pool.query(`INSERT INTO channels (name) VALUES ($1) ON CONFLICT DO NOTHING;`, [name]);
        }
        const channels = await pool.query('SELECT id, name FROM channels');
        const channelMap = {};
        channels.rows.forEach(c => channelMap[c.name] = c.id);

        const allVideos = [
            { source: 'RedTube', data: redtube },
            { source: 'Pornhub', data: pornhub },
            { source: 'Eporner', data: eporner },
            { source: 'Tube8', data: tube8 },
            { source: 'Thumbzilla', data: thumbzilla },
            { source: 'YouPorn', data: youporn }
        ];

        for (const set of allVideos) {
            const channelId = channelMap[set.source];
            for (const video of set.data) {
                if (!video) continue;
                
                const title = (video.title || "Untitled").replace(/'/g, "''");
                const embed = video.embed_url || video.embed || video.url || `https://example.com/embed/${video.id}`;
                const thumbnail = video.default_thumb ? (video.default_thumb.src || video.default_thumb) : (video.thumb || '');
                const durationSecs = parseDuration(video.duration || video.length_min || 0);
                const views = video.views || 0;

                const vRes = await pool.query(`
                    INSERT INTO videos (title, description, video_url, preview_url, duration, channel_id) 
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id;
                `, [title, `Views: ${views}`, embed, thumbnail, durationSecs, channelId]);
                
                if (vRes.rows.length > 0) {
                    let tagNames = [];
                    if (video.tags) tagNames = video.tags.map(t => t.tag_name || t);
                    else if (video.keywords) tagNames = video.keywords.split(',');
                    
                    await processTags(vRes.rows[0].id, tagNames);
                }
            }
        }

        console.log("Multi-API Ingestion and Dynamic Tag Extraction Completed!");

    } catch (e) {
        console.error("Failed to ingest data:", e);
    } finally {
        pool.end();
    }
}

ingestData();

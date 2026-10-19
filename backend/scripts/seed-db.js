import { createPool } from '../src/db.js';

const pool = createPool();

async function seed() {
    // TRUNCATE ... CASCADE wipes everything, including ingested real data.
    if (!process.argv.includes('--force')) {
        console.error('Seeding TRUNCATES all tables. Re-run with --force to confirm.');
        process.exitCode = 1;
        await pool.end();
        return;
    }
    console.log("Beginning Database Content Seeding...");

    try {
        // Clear existing mock data if any
        await pool.query('TRUNCATE TABLE video_tags, video_models, videos, tags, models, channels RESTART IDENTITY CASCADE');

        // Insert Channels
        console.log("Seeding Channels...");
        const channelsRes = await pool.query(`
            INSERT INTO channels (name, description) VALUES 
            ('Aphrodite Official', 'Premium exclusive content'),
            ('Amateur Archives', 'Verified amateur submissions'),
            ('Studio X', 'High production value adult cinema')
            RETURNING id;
        `);
        const channelIds = channelsRes.rows.map(r => r.id);

        // Insert Models
        console.log("Seeding Models...");
        const modelsRes = await pool.query(`
            INSERT INTO models (name, bio, hair_color, height, bust_size, ethnicity) VALUES 
            ('Lexi Lore', 'Top tier performer', 'Blonde', 165, '34C', 'Caucasian'),
            ('Mia Melano', 'Award winning star', 'Brunette', 170, '36D', 'Caucasian'),
            ('Kenzie Reeves', 'Energetic and wild', 'Brunette', 158, '32B', 'Caucasian'),
            ('Abella Danger', 'Industry veteran', 'Brunette', 162, '34C', 'Hispanic')
            RETURNING id;
        `);
        const modelIds = modelsRes.rows.map(r => r.id);

        // Insert Tags
        console.log("Seeding Tags...");
        const tagsRes = await pool.query(`
            INSERT INTO tags (name, tag_type) VALUES 
            ('POV', 'Category'),
            ('Hardcore', 'Category'),
            ('Step-Sister', 'Taboo'),
            ('Stockings', 'Fetish'),
            ('MILF', 'Category'),
            ('Amateur', 'Category')
            RETURNING id, name;
        `);
        const tagsMap = {};
        tagsRes.rows.forEach(t => tagsMap[t.name] = t.id);

        // Insert Videos (Generate 50 realistic sounding videos)
        console.log("Seeding Videos...");
        const videoTitles = [
            "Step-Sister gets stuck in washing machine POV",
            "Incredible amateur compilation 2026",
            "Hardcore casting couch audition",
            "Stockings and high heels footjob",
            "MILF next door needs help with plumbing",
            "Exclusive Studio X release - Behind the Scenes",
            "Late night college party gone wild",
            "Intense workout turns into sweaty session",
            "Naughty maid caught stealing",
            "Step-Mom teaches a lesson"
        ];

        for (let i = 0; i < 50; i++) {
            const title = videoTitles[i % videoTitles.length] + ` Part ${Math.floor(i/10) + 1}`;
            const duration = Math.floor(Math.random() * 3300) + 300; // 5 mins to 60 mins
            const channelId = channelIds[i % channelIds.length];

            const vidRes = await pool.query(`
                INSERT INTO videos (title, description, video_url, preview_url, duration, channel_id) 
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id;
            `, [title, 'Auto-generated mock description for ' + title, `mock_hls_stream_${i}.m3u8`, '/mock-preview.jpg', duration, channelId]);
            
            const vidId = vidRes.rows[0].id;

            // Assign random models to video
            const numModels = Math.floor(Math.random() * 2) + 1;
            for(let m = 0; m < numModels; m++) {
                await pool.query('INSERT INTO video_models (video_id, model_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', 
                    [vidId, modelIds[(i+m) % modelIds.length]]);
            }

            // Assign tags based on title keywords (simulating NLP)
            if (title.toLowerCase().includes('step-sister')) {
                await pool.query('INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2)', [vidId, tagsMap['Step-Sister']]);
                await pool.query('INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2)', [vidId, tagsMap['POV']]);
            }
            if (title.toLowerCase().includes('hardcore')) {
                await pool.query('INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2)', [vidId, tagsMap['Hardcore']]);
            }
            if (title.toLowerCase().includes('stockings')) {
                await pool.query('INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2)', [vidId, tagsMap['Stockings']]);
            }
            if (title.toLowerCase().includes('milf') || title.toLowerCase().includes('step-mom')) {
                await pool.query('INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2)', [vidId, tagsMap['MILF']]);
            }
            if (title.toLowerCase().includes('amateur')) {
                await pool.query('INSERT INTO video_tags (video_id, tag_id) VALUES ($1, $2)', [vidId, tagsMap['Amateur']]);
            }
        }

        console.log("Seeding Completed Successfully!");
    } catch(e) {
        console.error("Error during seeding:", e);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

seed();
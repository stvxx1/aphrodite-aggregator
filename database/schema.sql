-- Aphrodite Aggregator Initial Schema

-- Channels
CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Models (Performers)
CREATE TABLE IF NOT EXISTS models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    bio TEXT,
    hair_color VARCHAR(50), -- e.g. hex range or string
    height INTEGER,         -- in cm
    bust_size VARCHAR(20),  -- e.g. 34C
    ethnicity VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Videos
CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,       -- Direct MP4/HLS
    preview_url TEXT,              -- Hover sprite
    duration INTEGER NOT NULL,     -- In seconds
    channel_id INTEGER REFERENCES channels(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP,
    -- Full text search vectors
    search_vector tsvector
);

-- Video Models Mapping
CREATE TABLE IF NOT EXISTS video_models (
    video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
    model_id INTEGER REFERENCES models(id) ON DELETE CASCADE,
    PRIMARY KEY (video_id, model_id)
);

-- Tags Structure (Category, Fetish)
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    tag_type VARCHAR(50) NOT NULL -- 'Category', 'Fetish', etc
);

-- Video Tags Mapping
CREATE TABLE IF NOT EXISTS video_tags (
    video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (video_id, tag_id)
);

-- GIN Indexes for fast search
CREATE INDEX idx_videos_search_vector ON videos USING GIN(search_vector);
CREATE INDEX idx_videos_duration ON videos (duration);
CREATE INDEX idx_models_attributes ON models (hair_color, height, bust_size, ethnicity);

-- Trigger to update search vector automatically
CREATE OR REPLACE FUNCTION videos_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_videos_search_vector
  BEFORE INSERT OR UPDATE
  ON videos
  FOR EACH ROW
  EXECUTE FUNCTION videos_search_vector_update();

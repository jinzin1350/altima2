-- Network Monitoring Analytics Dashboard
-- Supabase Database Setup Script
-- Run this entire script in your Supabase SQL Editor

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  problem_id VARCHAR(20) UNIQUE,
  timestamp TIMESTAMPTZ,
  status VARCHAR(20),
  alert_type VARCHAR(100),
  host VARCHAR(100),
  interface VARCHAR(100),
  severity VARCHAR(20),
  provider VARCHAR(50),
  duration_seconds INT,
  description TEXT,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create file_uploads table
CREATE TABLE IF NOT EXISTS file_uploads (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255),
  upload_date TIMESTAMPTZ DEFAULT NOW(),
  records_count INT,
  records_added INT,
  records_skipped INT,
  date_range_start TIMESTAMPTZ,
  date_range_end TIMESTAMPTZ,
  status VARCHAR(50)
);

-- Step 4: Create hosts table
CREATE TABLE IF NOT EXISTS hosts (
  id SERIAL PRIMARY KEY,
  host_name VARCHAR(100) UNIQUE,
  total_alerts INT DEFAULT 0,
  active_problems INT DEFAULT 0,
  last_seen TIMESTAMPTZ
);

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS alerts_timestamp_idx ON alerts(timestamp);
CREATE INDEX IF NOT EXISTS alerts_host_idx ON alerts(host);
CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts(status);
CREATE INDEX IF NOT EXISTS alerts_problem_id_idx ON alerts(problem_id);

-- Step 6: Create vector search index
-- Note: This may take a few moments to build
CREATE INDEX IF NOT EXISTS alerts_embedding_idx
ON alerts USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Step 7: Create vector search function
CREATE OR REPLACE FUNCTION match_alerts(
  query_embedding VECTOR(1536),
  match_threshold FLOAT,
  match_count INT
)
RETURNS TABLE (
  id INT,
  problem_id VARCHAR,
  host VARCHAR,
  description TEXT,
  alert_timestamp TIMESTAMPTZ,
  status VARCHAR,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    alerts.id,
    alerts.problem_id,
    alerts.host,
    alerts.description,
    alerts.timestamp AS alert_timestamp,
    alerts.status,
    1 - (alerts.embedding <=> query_embedding) AS similarity
  FROM alerts
  WHERE 1 - (alerts.embedding <=> query_embedding) > match_threshold
  ORDER BY alerts.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 8: Grant necessary permissions (if needed)
-- Uncomment if you need to grant specific permissions
-- GRANT ALL ON alerts TO anon, authenticated;
-- GRANT ALL ON file_uploads TO anon, authenticated;
-- GRANT ALL ON hosts TO anon, authenticated;

-- Verification queries
-- Run these to verify everything was created successfully

-- Check if tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('alerts', 'file_uploads', 'hosts');

-- Check if function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'match_alerts';

-- Check if indexes exist
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'alerts';

-- Done! Your database is ready to use.
-- Next steps:
-- 1. Update your .env file with Supabase credentials
-- 2. Run: npm run dev
-- 3. Upload your first HTML file via the dashboard

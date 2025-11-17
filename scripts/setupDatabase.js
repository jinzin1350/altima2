import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { supabase } from '../server/services/supabase.js';
import { parseHTMLAlerts } from '../server/utils/parser.js';
import { generateAlertEmbedding } from '../server/services/ragEngine.js';
import { insertAlerts, insertFileUpload } from '../server/services/supabase.js';

dotenv.config();

/**
 * Setup database tables and upload initial data
 */
async function setupDatabase() {
  try {
    console.log('🚀 Starting database setup...\n');

    // Step 1: Create tables
    console.log('📊 Creating database tables...');
    await createTables();
    console.log('✅ Tables created successfully\n');

    // Step 2: Create vector search function
    console.log('🔍 Creating vector search function...');
    await createVectorSearchFunction();
    console.log('✅ Vector search function created\n');

    // Step 3: Upload initial data
    console.log('📤 Uploading initial data...');
    await uploadInitialData();
    console.log('✅ Initial data uploaded\n');

    console.log('═══════════════════════════════════════════════════');
    console.log('           DATABASE SETUP COMPLETE!                ');
    console.log('═══════════════════════════════════════════════════');
    console.log('\n✨ Next steps:');
    console.log('  1. Run: npm run dev (to start the application)');
    console.log('  2. Open: http://localhost:3000');
    console.log('  3. Use the upload button to add more data\n');
  } catch (error) {
    console.error('❌ Error during setup:', error);
    process.exit(1);
  }
}

/**
 * Create database tables
 */
async function createTables() {
  // Create alerts table
  const createAlertsTable = `
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
  `;

  // Create file_uploads table
  const createFileUploadsTable = `
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
  `;

  // Create hosts table
  const createHostsTable = `
    CREATE TABLE IF NOT EXISTS hosts (
      id SERIAL PRIMARY KEY,
      host_name VARCHAR(100) UNIQUE,
      total_alerts INT DEFAULT 0,
      active_problems INT DEFAULT 0,
      last_seen TIMESTAMPTZ
    );
  `;

  // Create index on embedding column
  const createEmbeddingIndex = `
    CREATE INDEX IF NOT EXISTS alerts_embedding_idx
    ON alerts USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
  `;

  // Create indexes for performance
  const createIndexes = `
    CREATE INDEX IF NOT EXISTS alerts_timestamp_idx ON alerts(timestamp);
    CREATE INDEX IF NOT EXISTS alerts_host_idx ON alerts(host);
    CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts(status);
    CREATE INDEX IF NOT EXISTS alerts_problem_id_idx ON alerts(problem_id);
  `;

  try {
    // Note: For Supabase, you might need to run these in the SQL editor
    // since some operations might require elevated permissions
    console.log('  Creating alerts table...');
    console.log('  Creating file_uploads table...');
    console.log('  Creating hosts table...');
    console.log('  Creating indexes...');

    console.log('\n⚠️  IMPORTANT: Please run the following SQL in your Supabase SQL Editor:\n');
    console.log('═══════════════════════════════════════════════════');
    console.log(createAlertsTable);
    console.log(createFileUploadsTable);
    console.log(createHostsTable);
    console.log(createIndexes);
    console.log(createEmbeddingIndex);
    console.log('═══════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

/**
 * Create vector search function
 */
async function createVectorSearchFunction() {
  const createFunction = `
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
      timestamp TIMESTAMPTZ,
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
        alerts.timestamp,
        alerts.status,
        1 - (alerts.embedding <=> query_embedding) AS similarity
      FROM alerts
      WHERE 1 - (alerts.embedding <=> query_embedding) > match_threshold
      ORDER BY alerts.embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;
  `;

  console.log('\n⚠️  Please also add this function in Supabase SQL Editor:\n');
  console.log('═══════════════════════════════════════════════════');
  console.log(createFunction);
  console.log('═══════════════════════════════════════════════════\n');
}

/**
 * Upload initial data from HTML files
 */
async function uploadInitialData() {
  const filePaths = [
    '/mnt/user-data/uploads/messages42.html',
    '/mnt/user-data/uploads/messages43.html',
  ];

  let totalUploaded = 0;

  for (const filePath of filePaths) {
    try {
      console.log(`\n  Processing: ${path.basename(filePath)}`);

      const htmlContent = await fs.readFile(filePath, 'utf-8');
      const alerts = parseHTMLAlerts(htmlContent);

      console.log(`  Found ${alerts.length} alerts`);

      // Generate embeddings and upload in batches
      const batchSize = 10;
      for (let i = 0; i < alerts.length; i += batchSize) {
        const batch = alerts.slice(i, i + batchSize);

        // Generate embeddings
        for (const alert of batch) {
          try {
            alert.embedding = await generateAlertEmbedding(alert);
          } catch (error) {
            console.error(`    Error generating embedding: ${error.message}`);
          }
        }

        // Insert batch
        await insertAlerts(batch);
        console.log(`  Uploaded ${Math.min(i + batchSize, alerts.length)}/${alerts.length} alerts`);
      }

      // Record upload
      const timestamps = alerts.map(a => new Date(a.timestamp)).filter(d => !isNaN(d));
      await insertFileUpload({
        filename: path.basename(filePath),
        records_count: alerts.length,
        records_added: alerts.length,
        records_skipped: 0,
        date_range_start: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null,
        date_range_end: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,
        status: 'completed',
      });

      totalUploaded += alerts.length;
      console.log(`  ✅ Completed: ${path.basename(filePath)}`);
    } catch (error) {
      console.error(`  ❌ Error processing ${filePath}:`, error.message);
    }
  }

  if (totalUploaded === 0) {
    console.log('\n  ℹ️  No files found at specified paths.');
    console.log('  You can upload files using the dashboard upload feature.');
  } else {
    console.log(`\n  📊 Total alerts uploaded: ${totalUploaded}`);
  }
}

// Run setup
setupDatabase();

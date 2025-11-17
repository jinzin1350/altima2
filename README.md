# Network Monitoring Analytics Dashboard

AI-powered network monitoring analytics dashboard with RAG (Retrieval-Augmented Generation) and SQL capabilities. Built with Node.js, React, Supabase, and OpenAI GPT-4o-mini.

## Features

- **AI-Powered Chat**: Ask questions about your network alerts using natural language
- **Hybrid Intelligence**: Automatically chooses between SQL and RAG based on query type
- **File Upload**: Easy drag-and-drop interface for uploading HTML alert files
- **Duplicate Detection**: Automatically skips duplicate alerts during upload
- **Upload History**: Track all file uploads with detailed statistics
- **Real-time Dashboard**: Live statistics and recent alerts
- **Vector Search**: Semantic search using OpenAI embeddings
- **Beautiful UI**: Modern dark theme with glassmorphism effects

## Tech Stack

### Backend
- **Node.js** + Express
- **Supabase** (PostgreSQL with pgvector)
- **OpenAI API** (text-embedding-3-small + gpt-4o-mini)
- **Cheerio** (HTML parsing)
- **Multer** (File uploads)

### Frontend
- **React** + Vite
- **CSS3** (Glassmorphism design)

## Prerequisites

- Node.js 18+
- Supabase account
- OpenAI API key
- Network monitoring HTML files (e.g., messages42.html, messages43.html)

## Installation

### 1. Clone and Install Dependencies

```bash
# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
OPENAI_API_KEY=sk-your-openai-api-key
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

### 3. Set Up Supabase Database

#### Enable pgvector Extension

In your Supabase SQL Editor, run:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

#### Create Tables

Run the following SQL in Supabase SQL Editor:

```sql
-- Alerts table
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

-- File uploads table
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

-- Hosts table
CREATE TABLE IF NOT EXISTS hosts (
  id SERIAL PRIMARY KEY,
  host_name VARCHAR(100) UNIQUE,
  total_alerts INT DEFAULT 0,
  active_problems INT DEFAULT 0,
  last_seen TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS alerts_timestamp_idx ON alerts(timestamp);
CREATE INDEX IF NOT EXISTS alerts_host_idx ON alerts(host);
CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts(status);
CREATE INDEX IF NOT EXISTS alerts_problem_id_idx ON alerts(problem_id);

-- Vector search index
CREATE INDEX IF NOT EXISTS alerts_embedding_idx
ON alerts USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

#### Create Vector Search Function

```sql
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
```

### 4. (Optional) Analyze HTML Files

If you have sample HTML files, run the analysis script:

```bash
npm run analyze
```

This will:
- Read sample HTML files
- Send to GPT-4o-mini for structure analysis
- Generate recommendations
- Save report to `data-analysis-report.json`

### 5. (Optional) Upload Initial Data

If you have HTML files at `/mnt/user-data/uploads/`, run:

```bash
npm run setup
```

This will:
- Parse HTML files
- Generate embeddings
- Upload to Supabase
- Record upload history

## Running the Application

### Development Mode

```bash
# Start both server and client
npm run dev
```

This starts:
- Backend server on `http://localhost:3000`
- Frontend dev server on `http://localhost:5173`

### Production Mode

```bash
# Build frontend
cd client
npm run build
cd ..

# Start server
npm start
```

## Usage

### 1. Upload Network Monitoring Data

1. Click the **"📤 Upload New Data"** button in the top-right corner
2. Drag and drop HTML files or click to browse
3. Review the preview showing:
   - Total messages found
   - Number of new alerts vs. duplicates
   - Date range
   - Hosts found
4. Click **"Upload & Process"**
5. Wait for processing (embeddings are generated)
6. Dashboard automatically refreshes with new data

### 2. Ask Questions with AI Chat

The AI assistant automatically detects query type:

**SQL Queries** (Statistics & Counts):
- "How many total alerts do we have?"
- "Show me alerts from the last 2 days"
- "Which hosts have the most alerts?"
- "How many active problems are there?"

**RAG Queries** (Analysis & Insights):
- "Why is TRT failing?"
- "Analyze the pattern of bandwidth issues"
- "What caused the recent outages?"
- "Explain the interface down alerts"

### 3. View Dashboard Statistics

- **Total Alerts**: Overall count of all alerts
- **Active Problems**: Current unresolved issues
- **Resolved**: Successfully resolved alerts
- **Top Hosts**: Hosts with most alerts
- **Recent Alerts**: Latest 10 alerts with status

### 4. Track Upload History

View all previous file uploads with:
- Filename and upload date
- Records added vs. skipped
- Processing status

## API Endpoints

### Statistics
- `GET /api/stats/total` - Total alert count
- `GET /api/stats/last-n-days?days=2` - Alerts from last N days
- `GET /api/stats/by-host` - Alerts grouped by host
- `GET /api/stats/active` - Active/unresolved alerts
- `GET /api/stats/recent?limit=50` - Recent alerts
- `GET /api/stats/summary` - Complete dashboard summary

### Chat
- `POST /api/chat` - Process user question
  ```json
  {
    "message": "How many alerts are there?"
  }
  ```
- `GET /api/chat/suggestions` - Get suggested questions

### Upload
- `POST /api/upload/analyze` - Analyze HTML file (preview)
- `POST /api/upload/process` - Process and upload HTML files
- `GET /api/upload/history?limit=10` - Get upload history

## Project Structure

```
/
├── server/
│   ├── index.js                 # Express server
│   ├── routes/
│   │   ├── stats.js            # Statistics endpoints
│   │   ├── chat.js             # AI chat endpoints
│   │   └── upload.js           # File upload endpoints
│   ├── services/
│   │   ├── supabase.js         # Supabase client & queries
│   │   ├── openai.js           # OpenAI API integration
│   │   ├── sqlEngine.js        # SQL query generation
│   │   └── ragEngine.js        # RAG implementation
│   └── utils/
│       └── parser.js           # HTML parser
├── client/
│   ├── src/
│   │   ├── App.jsx             # Main app component
│   │   ├── components/
│   │   │   ├── Dashboard.jsx   # Stats dashboard
│   │   │   ├── ChatBox.jsx     # AI chat interface
│   │   │   ├── UploadModal.jsx # File upload modal
│   │   │   └── UploadHistory.jsx # Upload history
│   │   └── styles/
│   │       └── App.css         # Glassmorphism styles
│   └── package.json
├── scripts/
│   ├── analyzeData.js          # AI data analysis script
│   └── setupDatabase.js        # Database setup script
├── uploads/                     # Uploaded files directory
├── package.json
├── .env
└── README.md
```

## How It Works

### File Upload Process

1. **Upload**: User uploads HTML files via drag-and-drop
2. **Parse**: Cheerio extracts alert data from HTML
3. **Duplicate Check**: Checks Supabase for existing problem_id
4. **Generate Embeddings**: OpenAI creates vector embeddings
5. **Insert**: Batch insert new alerts to Supabase
6. **Record**: Log upload in file_uploads table
7. **Refresh**: Dashboard updates automatically

### AI Chat Process

#### SQL Mode
1. User asks statistical question
2. GPT-4o-mini generates SQL query
3. Execute query on Supabase
4. Format results with GPT-4o-mini
5. Return answer with metadata

#### RAG Mode
1. User asks analytical question
2. Generate query embedding
3. Vector search in Supabase (pgvector)
4. Retrieve top relevant alerts
5. Send context + question to GPT-4o-mini
6. Return analysis with sources

## Cost Optimization

- Uses **gpt-4o-mini** (cheap, fast)
- Uses **text-embedding-3-small** (1536 dimensions)
- Batch processing for embeddings
- Caches chat suggestions
- Efficient vector search with ivfflat index

## Troubleshooting

### Database Connection Issues
- Verify Supabase URL and key in `.env`
- Check if pgvector extension is enabled
- Ensure tables and functions are created

### File Upload Fails
- Check file size (max 10MB default)
- Ensure HTML format is correct
- Verify OpenAI API key for embeddings

### Chat Not Working
- Check OpenAI API quota
- Verify Supabase connection
- Check browser console for errors

### No Data Showing
- Upload HTML files using the upload button
- Check upload history for errors
- Verify data in Supabase dashboard

## Development

### Adding Custom Parsers

Edit `server/utils/parser.js` to customize HTML parsing:

```javascript
function extractHost($, $row, cells) {
  // Your custom extraction logic
  return hostName;
}
```

### Customizing AI Prompts

Edit `server/services/sqlEngine.js` or `ragEngine.js`:

```javascript
const messages = [
  {
    role: 'system',
    content: 'Your custom system prompt...'
  }
];
```

### Styling

Edit `client/src/styles/App.css` to customize the theme:

```css
:root {
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* Customize colors here */
}
```

## Deployment

### Replit

1. Import this repository to Replit
2. Add secrets in Replit's Secrets tab:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `OPENAI_API_KEY`
3. Run: `npm run dev`
4. Replit will handle port forwarding

### Other Platforms

- **Vercel/Netlify**: Deploy frontend separately
- **Heroku/Railway**: Deploy full-stack app
- **Docker**: Use provided Dockerfile (if created)

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Support

For issues or questions:
- Check the troubleshooting section
- Review Supabase logs
- Check browser console errors
- Verify API keys and credentials

---

Built with ❤️ using Node.js, React, Supabase, and OpenAI

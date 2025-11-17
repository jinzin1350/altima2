// Polyfill for Node.js 18 compatibility with Supabase
import './polyfill.js';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import statsRoutes from './routes/stats.js';
import chatRoutes from './routes/chat.js';
import uploadRoutes from './routes/upload.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/stats', statsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/upload', uploadRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║  Network Monitoring Analytics Dashboard              ║
║  Server running on http://localhost:${PORT}           ║
║                                                       ║
║  Endpoints:                                           ║
║  • GET  /health                                       ║
║  • GET  /api/stats/*                                  ║
║  • POST /api/chat                                     ║
║  • POST /api/upload/*                                 ║
╚═══════════════════════════════════════════════════════╝
  `);
});

export default app;

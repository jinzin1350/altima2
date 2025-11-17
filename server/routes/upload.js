import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { parseHTMLAlerts, getPreviewStats } from '../utils/parser.js';
import { alertExists, insertAlerts, insertFileUpload } from '../services/supabase.js';
import { generateAlertEmbedding } from '../services/ragEngine.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB default
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/html' || file.originalname.endsWith('.html')) {
      cb(null, true);
    } else {
      cb(new Error('Only HTML files are allowed'));
    }
  },
});

/**
 * POST /api/upload/analyze - Analyze HTML file and return preview
 */
router.post('/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Read file content
    const htmlContent = await fs.readFile(req.file.path, 'utf-8');

    // Get preview statistics
    const preview = getPreviewStats(htmlContent);

    // Check for duplicates
    let duplicatesCount = 0;
    for (const alert of preview.alerts) {
      const exists = await alertExists(alert.problem_id);
      if (exists) duplicatesCount++;
    }

    // Clean up the temporary file
    await fs.unlink(req.file.path);

    res.json({
      filename: req.file.originalname,
      totalMessages: preview.totalMessages,
      dateRange: preview.dateRange,
      hostsCount: preview.hostsCount,
      hosts: preview.hosts,
      duplicatesFound: duplicatesCount,
      newAlerts: preview.totalMessages - duplicatesCount,
    });
  } catch (error) {
    console.error('Error analyzing file:', error);

    // Clean up file on error
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error deleting file:', unlinkError);
      }
    }

    res.status(500).json({
      error: 'Failed to analyze file',
      details: error.message,
    });
  }
});

/**
 * POST /api/upload/process - Process and upload HTML file to database
 */
router.post('/process', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    let totalAdded = 0;
    let totalSkipped = 0;
    let totalProcessed = 0;
    const fileResults = [];

    for (const file of req.files) {
      try {
        console.log(`Processing file: ${file.originalname}`);

        // Read file content
        const htmlContent = await fs.readFile(file.path, 'utf-8');

        // Parse alerts
        const alerts = parseHTMLAlerts(htmlContent);
        console.log(`Parsed ${alerts.length} alerts from ${file.originalname}`);

        // Filter out duplicates and generate embeddings
        const newAlerts = [];
        let skipped = 0;

        for (const alert of alerts) {
          const exists = await alertExists(alert.problem_id);

          if (exists) {
            skipped++;
            continue;
          }

          // Generate embedding for the alert
          try {
            const embedding = await generateAlertEmbedding(alert);
            alert.embedding = embedding;
            newAlerts.push(alert);
          } catch (embeddingError) {
            console.error('Error generating embedding:', embeddingError);
            // Continue without embedding
            newAlerts.push(alert);
          }
        }

        // Insert new alerts in batches
        if (newAlerts.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < newAlerts.length; i += batchSize) {
            const batch = newAlerts.slice(i, i + batchSize);
            await insertAlerts(batch);
          }
        }

        // Get date range
        const timestamps = alerts.map(a => new Date(a.timestamp)).filter(d => !isNaN(d));
        const dateRangeStart = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null;
        const dateRangeEnd = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;

        // Record upload in database
        await insertFileUpload({
          filename: file.originalname,
          records_count: alerts.length,
          records_added: newAlerts.length,
          records_skipped: skipped,
          date_range_start: dateRangeStart,
          date_range_end: dateRangeEnd,
          status: 'completed',
        });

        totalAdded += newAlerts.length;
        totalSkipped += skipped;
        totalProcessed += alerts.length;

        fileResults.push({
          filename: file.originalname,
          totalAlerts: alerts.length,
          added: newAlerts.length,
          skipped: skipped,
        });

        // Clean up file
        await fs.unlink(file.path);
      } catch (fileError) {
        console.error(`Error processing file ${file.originalname}:`, fileError);

        // Record failed upload
        try {
          await insertFileUpload({
            filename: file.originalname,
            records_count: 0,
            records_added: 0,
            records_skipped: 0,
            status: 'failed',
          });
        } catch (dbError) {
          console.error('Error recording failed upload:', dbError);
        }

        // Clean up file
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }

        fileResults.push({
          filename: file.originalname,
          error: fileError.message,
        });
      }
    }

    res.json({
      success: true,
      summary: {
        filesProcessed: req.files.length,
        totalAlerts: totalProcessed,
        recordsAdded: totalAdded,
        recordsSkipped: totalSkipped,
      },
      files: fileResults,
    });
  } catch (error) {
    console.error('Error processing upload:', error);

    // Clean up any uploaded files
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      }
    }

    res.status(500).json({
      error: 'Failed to process upload',
      details: error.message,
    });
  }
});

/**
 * GET /api/upload/history - Get upload history
 */
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const { getUploadHistory } = await import('../services/supabase.js');
    const history = await getUploadHistory(limit);

    res.json({
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error getting upload history:', error);
    res.status(500).json({
      error: 'Failed to get upload history',
      details: error.message,
    });
  }
});

export default router;

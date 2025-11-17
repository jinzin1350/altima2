import express from 'express';
import { shouldUseSQL, processSQLQuestion } from '../services/sqlEngine.js';
import { shouldUseRAG, processRAGQuestion } from '../services/ragEngine.js';

const router = express.Router();

/**
 * POST /api/chat - Process user question with AI
 */
router.post('/', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Processing question:', message);
    console.log('Conversation history length:', history.length);

    let response;

    // Determine which approach to use
    if (shouldUseSQL(message)) {
      console.log('Using SQL approach');
      response = await processSQLQuestion(message, history);
    } else if (shouldUseRAG(message)) {
      console.log('Using RAG approach');
      response = await processRAGQuestion(message, history);
    } else {
      // Default to SQL for general queries
      console.log('Using SQL approach (default)');
      response = await processSQLQuestion(message, history);
    }

    res.json({
      reply: response.answer,
      type: response.type,
      metadata: response.metadata,
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({
      error: 'Failed to process your question',
      details: error.message,
    });
  }
});

/**
 * GET /api/chat/suggestions - Get suggested questions
 */
router.get('/suggestions', async (req, res) => {
  try {
    const suggestions = [
      {
        category: 'Statistics',
        questions: [
          'How many total alerts do we have?',
          'Show me alerts from the last 2 days',
          'Which hosts have the most alerts?',
          'How many active problems are there?',
        ],
      },
      {
        category: 'Analysis',
        questions: [
          'Why is TRT failing?',
          'Analyze the pattern of bandwidth issues',
          'What caused the recent outages?',
          'Explain the interface down alerts',
        ],
      },
      {
        category: 'Troubleshooting',
        questions: [
          'What are the most critical alerts right now?',
          'Which interfaces are experiencing problems?',
          'Show me high severity alerts',
          'What hosts need immediate attention?',
        ],
      },
    ];

    res.json({ suggestions });
  } catch (error) {
    console.error('Error getting suggestions:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

export default router;

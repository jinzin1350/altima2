import { generateEmbedding, generateChatCompletion } from './openai.js';
import { searchAlertsByEmbedding } from './supabase.js';

/**
 * Determine if a question should be handled by RAG
 * @param {string} question - User question
 * @returns {boolean} - True if RAG should be used
 */
export function shouldUseRAG(question) {
  const ragKeywords = [
    'why',
    'analyze',
    'recommend',
    'explain',
    'pattern',
    'trend',
    'cause',
    'reason',
    'what happened',
    'diagnose',
    'investigate',
    'understand',
    'insight',
    'suggest',
  ];

  const lowerQuestion = question.toLowerCase();
  return ragKeywords.some(keyword => lowerQuestion.includes(keyword));
}

/**
 * Process a question using RAG approach
 * @param {string} question - User question
 * @param {Array} history - Conversation history
 * @returns {Promise<Object>} - Response with answer and sources
 */
export async function processRAGQuestion(question, history = []) {
  try {
    // Generate embedding for the question
    console.log('Generating embedding for question...');
    const questionEmbedding = await generateEmbedding(question);

    // Search for relevant alerts
    console.log('Searching for relevant alerts...');
    const relevantAlerts = await searchAlertsByEmbedding(
      questionEmbedding,
      0.7, // similarity threshold
      10   // number of results
    );

    console.log(`Found ${relevantAlerts?.length || 0} relevant alerts`);

    if (!relevantAlerts || relevantAlerts.length === 0) {
      return {
        answer: "I couldn't find any relevant alerts to answer your question. Try asking about specific hosts, time periods, or alert types.",
        type: 'rag',
        metadata: {
          sources: [],
          relevantCount: 0,
        },
      };
    }

    // Format context from relevant alerts
    const context = formatAlertsContext(relevantAlerts);

    // Generate answer using GPT-4o-mini with conversation history
    const answer = await generateRAGAnswer(question, context, relevantAlerts, history);

    return {
      answer,
      type: 'rag',
      metadata: {
        sources: relevantAlerts.map(alert => ({
          problem_id: alert.problem_id,
          host: alert.host,
          timestamp: alert.timestamp,
          description: alert.description,
          similarity: alert.similarity,
        })),
        relevantCount: relevantAlerts.length,
      },
    };
  } catch (error) {
    console.error('Error processing RAG question:', error);
    throw error;
  }
}

/**
 * Format alerts into context for RAG
 * @param {Array} alerts - Relevant alerts
 * @returns {string} - Formatted context
 */
function formatAlertsContext(alerts) {
  let context = 'Relevant Network Monitoring Alerts:\n\n';

  alerts.forEach((alert, index) => {
    context += `Alert ${index + 1}:\n`;
    context += `- Problem ID: ${alert.problem_id}\n`;
    context += `- Host: ${alert.host}\n`;
    context += `- Status: ${alert.status}\n`;
    context += `- Timestamp: ${new Date(alert.timestamp).toLocaleString()}\n`;
    context += `- Description: ${alert.description}\n`;
    if (alert.interface) context += `- Interface: ${alert.interface}\n`;
    if (alert.severity) context += `- Severity: ${alert.severity}\n`;
    if (alert.duration_seconds) context += `- Duration: ${Math.floor(alert.duration_seconds / 60)} minutes\n`;
    context += `- Similarity: ${(alert.similarity * 100).toFixed(1)}%\n`;
    context += '\n';
  });

  return context;
}

/**
 * Generate answer using RAG context
 * @param {string} question - User question
 * @param {string} context - Formatted context from alerts
 * @param {Array} alerts - Relevant alerts
 * @param {Array} history - Conversation history
 * @returns {Promise<string>} - Generated answer
 */
async function generateRAGAnswer(question, context, alerts, history = []) {
  const messages = [
    {
      role: 'system',
      content: `You are a network monitoring expert analyzing alerts and issues.

Your task is to:
1. Analyze the provided network monitoring alerts
2. Answer the user's question based on the context and conversation history
3. Identify patterns, trends, or issues
4. Provide actionable insights and recommendations
5. Reference specific alerts when making points
6. Maintain context from previous questions in the conversation

Guidelines:
- Be concise but thorough
- Use technical terms appropriately
- Provide specific examples from the alerts
- If you see patterns, mention them
- Give practical recommendations
- Remember previous questions and build upon them
- If the question cannot be fully answered from the context, say so`,
    },
  ];

  // Add conversation history (last 6 messages = 3 exchanges)
  if (history.length > 0) {
    const recentHistory = history.slice(-6);
    recentHistory.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });
  }

  // Add current question with context
  messages.push({
    role: 'user',
    content: `${context}

Question: ${question}

Please analyze the alerts above and provide a detailed answer.`,
  });

  try {
    const answer = await generateChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 1000,
    });

    // Add sources reference at the end
    const sourcesText = `\n\nSources: ${alerts.length} relevant alert(s) analyzed (similarity: ${(alerts[0]?.similarity * 100).toFixed(0)}% - ${(alerts[alerts.length - 1]?.similarity * 100).toFixed(0)}%)`;

    return answer + sourcesText;
  } catch (error) {
    console.error('Error generating RAG answer:', error);
    throw error;
  }
}

/**
 * Generate embeddings for alert descriptions
 * @param {Object} alert - Alert object
 * @returns {Promise<Array>} - Embedding vector
 */
export async function generateAlertEmbedding(alert) {
  // Combine relevant fields for better semantic search
  const textToEmbed = [
    alert.host,
    alert.alert_type,
    alert.description,
    alert.interface,
    alert.status,
    alert.severity,
  ]
    .filter(Boolean)
    .join(' | ');

  return await generateEmbedding(textToEmbed);
}

export default {
  shouldUseRAG,
  processRAGQuestion,
  generateAlertEmbedding,
};

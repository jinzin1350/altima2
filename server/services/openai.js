import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate embeddings for text using OpenAI's text-embedding-3-small model
 * @param {string} text - Text to generate embeddings for
 * @returns {Promise<number[]>} - Array of embedding values
 */
export async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Generate chat completion using GPT-4o-mini
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Additional options (temperature, etc.)
 * @returns {Promise<string>} - AI response text
 */
export async function generateChatCompletion(messages, options = {}) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating chat completion:', error);
    throw new Error('Failed to generate chat completion');
  }
}

/**
 * Analyze HTML content and provide recommendations
 * @param {string} htmlSample - Sample HTML content to analyze
 * @returns {Promise<Object>} - Analysis results and recommendations
 */
export async function analyzeDataStructure(htmlSample) {
  const prompt = `Analyze this HTML sample from a network monitoring system and provide recommendations:

${htmlSample}

Please provide a JSON response with:
1. dataFields: List of all data fields found and their usefulness (name, description, useful: true/false)
2. databaseSchema: Recommended PostgreSQL table structure
3. embeddingStrategy: What fields should be embedded for RAG
4. exampleQuestions: 10 example questions users might ask
5. parsingStrategy: How to extract data from HTML

Return ONLY valid JSON, no markdown formatting.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a data analysis expert. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Error analyzing data structure:', error);
    throw new Error('Failed to analyze data structure');
  }
}

export default {
  generateEmbedding,
  generateChatCompletion,
  analyzeDataStructure,
};

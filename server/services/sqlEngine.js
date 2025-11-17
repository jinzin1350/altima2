import { generateChatCompletion } from './openai.js';
import { supabase } from './supabase.js';

/**
 * Determine if a question should be handled by SQL
 * @param {string} question - User question
 * @returns {boolean} - True if SQL should be used
 */
export function shouldUseSQL(question) {
  const sqlKeywords = [
    'how many',
    'count',
    'total',
    'show',
    'list',
    'get',
    'find',
    'what are',
    'which',
    'when',
    'statistics',
    'stats',
    'number of',
    'hosts',
    'alerts',
    'last',
    'recent',
  ];

  const lowerQuestion = question.toLowerCase();
  return sqlKeywords.some(keyword => lowerQuestion.includes(keyword));
}

/**
 * Generate SQL query from natural language question
 * @param {string} question - User question
 * @returns {Promise<string>} - Generated SQL query
 */
export async function generateSQLQuery(question) {
  const schema = `
Database Schema:
- Table: alerts
  Columns:
  - id (SERIAL PRIMARY KEY)
  - problem_id (VARCHAR(20) UNIQUE)
  - timestamp (TIMESTAMPTZ)
  - status (VARCHAR(20)) - Values: 'PROBLEM', 'OK', 'RESOLVED'
  - alert_type (VARCHAR(100))
  - host (VARCHAR(100))
  - interface (VARCHAR(100))
  - severity (VARCHAR(20)) - Values: 'CRITICAL', 'HIGH', 'WARNING', 'LOW'
  - provider (VARCHAR(50))
  - duration_seconds (INT)
  - description (TEXT)
  - created_at (TIMESTAMPTZ)

Common Queries:
- Count total alerts: SELECT COUNT(*) FROM alerts;
- Count by status: SELECT status, COUNT(*) FROM alerts GROUP BY status;
- Count by host: SELECT host, COUNT(*) FROM alerts GROUP BY host ORDER BY COUNT(*) DESC;
- Recent alerts: SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 10;
- Active problems: SELECT * FROM alerts WHERE status = 'PROBLEM';
`;

  const messages = [
    {
      role: 'system',
      content: `You are a SQL query generator. Generate PostgreSQL queries based on user questions.

${schema}

Rules:
1. Generate ONLY the SQL query, no explanations
2. Use proper PostgreSQL syntax
3. Always use single quotes for strings
4. For time-based queries, use NOW() and INTERVAL
5. Limit results to 100 max
6. Order results meaningfully`,
    },
    {
      role: 'user',
      content: question,
    },
  ];

  try {
    const sqlQuery = await generateChatCompletion(messages, { temperature: 0.3 });

    // Clean up the response - remove markdown code blocks if present
    let cleanQuery = sqlQuery.trim()
      .replace(/```sql\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Remove semicolon from end if present
    if (cleanQuery.endsWith(';')) {
      cleanQuery = cleanQuery.slice(0, -1);
    }

    return cleanQuery;
  } catch (error) {
    console.error('Error generating SQL query:', error);
    throw new Error('Failed to generate SQL query');
  }
}

/**
 * Execute SQL query safely
 * @param {string} query - SQL query to execute
 * @returns {Promise<Array>} - Query results
 */
export async function executeSQLQuery(query) {
  try {
    // Basic SQL injection prevention - only allow SELECT queries
    const trimmedQuery = query.trim().toUpperCase();
    if (!trimmedQuery.startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed');
    }

    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: query,
    });

    if (error) {
      // If the RPC doesn't exist, try direct query execution
      const { data: directData, error: directError } = await supabase
        .from('alerts')
        .select('*')
        .limit(100);

      if (directError) throw directError;
      return directData;
    }

    return data;
  } catch (error) {
    console.error('Error executing SQL query:', error);
    throw error;
  }
}

/**
 * Format SQL results into natural language
 * @param {string} question - Original question
 * @param {Array} results - Query results
 * @returns {Promise<string>} - Formatted response
 */
export async function formatSQLResults(question, results) {
  if (!results || results.length === 0) {
    return "I couldn't find any results for that query.";
  }

  // For simple count queries
  if (results.length === 1 && Object.keys(results[0]).length === 1) {
    const value = Object.values(results[0])[0];
    return `The answer is: ${value}`;
  }

  // Limit results to avoid token limit (max 20 results)
  const limitedResults = results.slice(0, 20);

  // Remove large fields like description and embedding to reduce tokens
  const cleanedResults = limitedResults.map(item => {
    const { description, embedding, ...rest } = item;
    return {
      ...rest,
      description: description ? description.substring(0, 100) + '...' : null
    };
  });

  // Format results as a table or list
  const messages = [
    {
      role: 'system',
      content: 'You are a helpful assistant that formats database query results into natural language responses. Be concise and clear.',
    },
    {
      role: 'user',
      content: `Question: ${question}

Results (showing first ${cleanedResults.length} of ${results.length}):
${JSON.stringify(cleanedResults, null, 2)}

Please provide a clear, concise answer based on these results.`,
    },
  ];

  try {
    const response = await generateChatCompletion(messages, { temperature: 0.5 });
    return response;
  } catch (error) {
    console.error('Error formatting results:', error);
    // Fallback to simple summary
    return `Found ${results.length} results. Top entries include: ${cleanedResults.slice(0, 5).map(r => r.host || r.problem_id).join(', ')}`;
  }
}

/**
 * Process a question using SQL approach
 * @param {string} question - User question
 * @returns {Promise<Object>} - Response with answer and metadata
 */
export async function processSQLQuestion(question) {
  try {
    // Generate SQL query
    const sqlQuery = await generateSQLQuery(question);
    console.log('Generated SQL:', sqlQuery);

    // Execute query
    const results = await executeSQLQuery(sqlQuery);
    console.log('Query results:', results?.length || 0, 'rows');

    // Format results
    const answer = await formatSQLResults(question, results);

    return {
      answer,
      type: 'sql',
      metadata: {
        query: sqlQuery,
        resultCount: results?.length || 0,
        results: results?.slice(0, 10), // Include first 10 results
      },
    };
  } catch (error) {
    console.error('Error processing SQL question:', error);
    throw error;
  }
}

export default {
  shouldUseSQL,
  generateSQLQuery,
  executeSQLQuery,
  formatSQLResults,
  processSQLQuestion,
};

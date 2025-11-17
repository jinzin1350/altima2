import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials in environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Insert a single alert into the database
 * @param {Object} alert - Alert object to insert
 * @returns {Promise<Object>} - Inserted alert
 */
export async function insertAlert(alert) {
  const { data, error } = await supabase
    .from('alerts')
    .insert([alert])
    .select()
    .single();

  if (error) {
    console.error('Error inserting alert:', error);
    throw error;
  }

  return data;
}

/**
 * Insert multiple alerts into the database
 * @param {Array} alerts - Array of alert objects
 * @returns {Promise<Array>} - Inserted alerts
 */
export async function insertAlerts(alerts) {
  const { data, error } = await supabase
    .from('alerts')
    .insert(alerts)
    .select();

  if (error) {
    console.error('Error inserting alerts:', error);
    throw error;
  }

  return data;
}

/**
 * Check if an alert exists by problem_id
 * @param {string} problemId - Problem ID to check
 * @returns {Promise<boolean>} - True if exists
 */
export async function alertExists(problemId) {
  const { data, error } = await supabase
    .from('alerts')
    .select('id')
    .eq('problem_id', problemId)
    .single();

  return data !== null;
}

/**
 * Get total alert count
 * @returns {Promise<number>} - Total count
 */
export async function getTotalAlerts() {
  const { count, error } = await supabase
    .from('alerts')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  return count;
}

/**
 * Get alerts from the last N days
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array>} - Alerts from last N days
 */
export async function getAlertsLastNDays(days = 2) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .gte('timestamp', since.toISOString())
    .order('timestamp', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get alert counts grouped by host
 * @returns {Promise<Array>} - Host statistics
 */
export async function getAlertsByHost() {
  const { data, error } = await supabase
    .from('alerts')
    .select('host, status')
    .order('host');

  if (error) throw error;

  // Group by host
  const hostMap = {};
  data.forEach((alert) => {
    if (!hostMap[alert.host]) {
      hostMap[alert.host] = { host: alert.host, total: 0, active: 0, resolved: 0 };
    }
    hostMap[alert.host].total++;
    if (alert.status === 'PROBLEM') {
      hostMap[alert.host].active++;
    } else {
      hostMap[alert.host].resolved++;
    }
  });

  return Object.values(hostMap).sort((a, b) => b.total - a.total);
}

/**
 * Get active (unresolved) alerts
 * @returns {Promise<Array>} - Active alerts
 */
export async function getActiveAlerts() {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('status', 'PROBLEM')
    .order('timestamp', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get recent alerts (last 50)
 * @param {number} limit - Number of alerts to return
 * @returns {Promise<Array>} - Recent alerts
 */
export async function getRecentAlerts(limit = 50) {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Perform vector similarity search
 * @param {Array} embedding - Query embedding vector
 * @param {number} matchThreshold - Similarity threshold (0-1)
 * @param {number} matchCount - Number of results to return
 * @returns {Promise<Array>} - Matching alerts with similarity scores
 */
export async function searchAlertsByEmbedding(
  embedding,
  matchThreshold = 0.7,
  matchCount = 10
) {
  const { data, error } = await supabase.rpc('match_alerts', {
    query_embedding: embedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error) {
    console.error('Error searching alerts:', error);
    throw error;
  }

  return data;
}

/**
 * Execute a custom SQL query
 * @param {string} query - SQL query to execute
 * @returns {Promise<Array>} - Query results
 */
export async function executeQuery(query) {
  const { data, error } = await supabase.rpc('execute_query', { query });

  if (error) throw error;
  return data;
}

/**
 * Insert file upload record
 * @param {Object} uploadInfo - Upload information
 * @returns {Promise<Object>} - Inserted record
 */
export async function insertFileUpload(uploadInfo) {
  const { data, error } = await supabase
    .from('file_uploads')
    .insert([uploadInfo])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get upload history
 * @param {number} limit - Number of records to return
 * @returns {Promise<Array>} - Upload history
 */
export async function getUploadHistory(limit = 10) {
  const { data, error } = await supabase
    .from('file_uploads')
    .select('*')
    .order('upload_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export default {
  supabase,
  insertAlert,
  insertAlerts,
  alertExists,
  getTotalAlerts,
  getAlertsLastNDays,
  getAlertsByHost,
  getActiveAlerts,
  getRecentAlerts,
  searchAlertsByEmbedding,
  executeQuery,
  insertFileUpload,
  getUploadHistory,
};

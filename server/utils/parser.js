import * as cheerio from 'cheerio';

/**
 * Parse HTML file and extract network monitoring alerts from Telegram export format
 * @param {string} htmlContent - HTML content to parse
 * @returns {Array} - Array of parsed alert objects
 */
export function parseHTMLAlerts(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const alerts = [];

  // Find all message divs
  $('.message.default').each((index, element) => {
    try {
      const $message = $(element);

      // Get the text content
      const textDiv = $message.find('.text');
      if (textDiv.length === 0) return;

      const textContent = textDiv.html();
      if (!textContent) return;

      // Get date/time from title attribute
      const dateElement = $message.find('.pull_right.date.details');
      const dateTitle = dateElement.attr('title');

      // Parse the alert text
      const alert = parseAlertText(textContent, dateTitle);

      if (alert && alert.problem_id) {
        alerts.push(alert);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  return alerts;
}

/**
 * Parse alert text content
 */
function parseAlertText(htmlText, dateTitle) {
  // Remove HTML tags and get plain text
  const text = htmlText.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');

  const lines = text.split('\n').map(l => l.trim()).filter(l => l);

  // Determine status from emoji
  let status = 'UNKNOWN';
  if (text.includes('✅') || text.includes('resolved')) {
    status = 'OK';
  } else if (text.includes('❌') || text.includes('Problem started')) {
    status = 'PROBLEM';
  }

  // Extract fields using regex
  const problemName = extractField(text, /Problem name:\s*(.+?)(?:\n|$)/i);
  const host = extractField(text, /Host:\s*(.+?)(?:\n|$)/i);
  const severity = extractField(text, /Severity:\s*(.+?)(?:\n|$)/i);
  const problemId = extractField(text, /Original problem ID:\s*(\d+)/i);

  // Extract timestamp
  let timestamp = new Date().toISOString();
  if (dateTitle) {
    // Parse format like "23.02.2022 10:12:45 UTC-05:00"
    const match = dateTitle.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      const [, day, month, year, hour, minute, second] = match;
      timestamp = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).toISOString();
    }
  }

  // Extract duration if mentioned
  let duration_seconds = 0;
  const durationMatch = text.match(/after\s+(\d+)m/i) || text.match(/After\s+(\d+)m/i);
  if (durationMatch) {
    duration_seconds = parseInt(durationMatch[1]) * 60;
  }

  // Determine alert type and interface
  let alert_type = 'General Alert';
  let interface_name = null;

  if (problemName) {
    alert_type = problemName;

    // Extract interface name if present
    const interfaceMatch = problemName.match(/Interface\s+([^:]+?):/);
    if (interfaceMatch) {
      interface_name = interfaceMatch[1].trim();
    }
  }

  // Map severity
  const severityMap = {
    'high': 'HIGH',
    'average': 'WARNING',
    'warning': 'WARNING',
    'low': 'LOW',
    'disaster': 'CRITICAL',
    'critical': 'CRITICAL'
  };

  const mappedSeverity = severityMap[severity?.toLowerCase()] || 'WARNING';

  return {
    problem_id: problemId,
    timestamp: timestamp,
    status: status,
    alert_type: alert_type,
    host: host || 'UNKNOWN',
    interface: interface_name,
    severity: mappedSeverity,
    provider: null,
    duration_seconds: duration_seconds,
    description: text.substring(0, 500),
  };
}

/**
 * Extract field using regex
 */
function extractField(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Get preview statistics from HTML
 * @param {string} htmlContent - HTML content
 * @returns {Object} - Preview statistics
 */
export function getPreviewStats(htmlContent) {
  const alerts = parseHTMLAlerts(htmlContent);

  const timestamps = alerts
    .map(a => new Date(a.timestamp))
    .filter(d => !isNaN(d));

  const hosts = [...new Set(alerts.map(a => a.host))].filter(h => h !== 'UNKNOWN');

  return {
    totalMessages: alerts.length,
    dateRange: {
      start: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null,
      end: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,
    },
    hostsCount: hosts.length,
    hosts: hosts,
    alerts: alerts,
  };
}

export default {
  parseHTMLAlerts,
  getPreviewStats,
};

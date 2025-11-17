import * as cheerio from 'cheerio';

/**
 * Parse HTML file and extract network monitoring alerts
 * @param {string} htmlContent - HTML content to parse
 * @returns {Array} - Array of parsed alert objects
 */
export function parseHTMLAlerts(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const alerts = [];

  // Find all table rows (typically alerts are in tables)
  $('table tr').each((index, element) => {
    try {
      const $row = $(element);
      const cells = $row.find('td');

      // Skip header rows or empty rows
      if (cells.length === 0) return;

      // Extract data from cells (this structure may need adjustment based on actual HTML)
      const alert = {
        timestamp: extractTimestamp($, $row, cells),
        status: extractStatus($, $row, cells),
        severity: extractSeverity($, $row, cells),
        host: extractHost($, $row, cells),
        interface: extractInterface($, $row, cells),
        alert_type: extractAlertType($, $row, cells),
        problem_id: extractProblemId($, $row, cells),
        description: extractDescription($, $row, cells),
        duration_seconds: extractDuration($, $row, cells),
        provider: extractProvider($, $row, cells),
      };

      // Only add if we have essential fields
      if (alert.problem_id && alert.host) {
        alerts.push(alert);
      }
    } catch (error) {
      console.error('Error parsing row:', error);
    }
  });

  return alerts;
}

/**
 * Extract timestamp from row
 */
function extractTimestamp($, $row, cells) {
  // Try different patterns
  const patterns = [
    () => cells.eq(0).text().trim(),
    () => $row.find('[class*="time"]').text().trim(),
    () => $row.find('[class*="date"]').text().trim(),
  ];

  for (const pattern of patterns) {
    const value = pattern();
    if (value && isValidDate(value)) {
      return new Date(value).toISOString();
    }
  }

  return new Date().toISOString();
}

/**
 * Extract status (PROBLEM, OK, etc.)
 */
function extractStatus($, $row, cells) {
  const text = $row.text().toUpperCase();
  if (text.includes('PROBLEM')) return 'PROBLEM';
  if (text.includes('OK')) return 'OK';
  if (text.includes('RESOLVED')) return 'RESOLVED';

  // Check for color indicators
  const bgcolor = $row.attr('bgcolor') || '';
  if (bgcolor.toLowerCase().includes('red') || bgcolor.includes('#ff')) return 'PROBLEM';
  if (bgcolor.toLowerCase().includes('green') || bgcolor.includes('#0f')) return 'OK';

  return 'UNKNOWN';
}

/**
 * Extract severity level
 */
function extractSeverity($, $row, cells) {
  const text = $row.text().toUpperCase();
  if (text.includes('DISASTER') || text.includes('CRITICAL')) return 'CRITICAL';
  if (text.includes('HIGH')) return 'HIGH';
  if (text.includes('AVERAGE') || text.includes('WARNING')) return 'WARNING';
  if (text.includes('LOW') || text.includes('INFORMATION')) return 'LOW';

  // Default based on status
  const status = extractStatus($, $row, cells);
  return status === 'PROBLEM' ? 'WARNING' : 'LOW';
}

/**
 * Extract host name
 */
function extractHost($, $row, cells) {
  // Look for patterns like "Host: XXX" or cell containing host info
  const patterns = [
    () => $row.find('[class*="host"]').text().trim(),
    () => cells.eq(1).text().trim(),
    () => {
      const text = $row.text();
      const match = text.match(/Host:\s*([^\s,]+)/i);
      return match ? match[1] : '';
    },
  ];

  for (const pattern of patterns) {
    const value = pattern();
    if (value && value.length > 0 && value.length < 100) {
      return value;
    }
  }

  return 'UNKNOWN';
}

/**
 * Extract interface name
 */
function extractInterface($, $row, cells) {
  const text = $row.text();
  const patterns = [
    /Interface:\s*([^\s,]+)/i,
    /Port:\s*([^\s,]+)/i,
    /([A-Z][a-z]+\s+\d+\/\d+\/\d+)/,  // e.g., "GigabitEthernet 0/0/1"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return null;
}

/**
 * Extract alert type
 */
function extractAlertType($, $row, cells) {
  const text = $row.text();

  // Common alert types
  const types = [
    'Interface down',
    'High bandwidth usage',
    'Packet loss',
    'High CPU',
    'High memory',
    'Disk space',
    'Service down',
    'Connection timeout',
    'Authentication failure',
  ];

  for (const type of types) {
    if (text.toLowerCase().includes(type.toLowerCase())) {
      return type;
    }
  }

  // Try to extract from problem description
  const match = text.match(/Problem:\s*([^:]+?)(?:Duration|Time|$)/i);
  if (match) return match[1].trim();

  return 'General Alert';
}

/**
 * Extract problem ID
 */
function extractProblemId($, $row, cells) {
  const text = $row.text();

  // Look for ID patterns
  const patterns = [
    /Problem ID:\s*(\d+)/i,
    /ID:\s*(\d+)/i,
    /#(\d+)/,
    /Event ID:\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  // Generate ID from timestamp and host if not found
  const host = extractHost($, $row, cells);
  const timestamp = extractTimestamp($, $row, cells);
  return `${host}-${new Date(timestamp).getTime()}`.substring(0, 20);
}

/**
 * Extract description
 */
function extractDescription($, $row, cells) {
  // Get all text and clean it up
  let text = $row.text()
    .replace(/\s+/g, ' ')
    .trim();

  // Remove redundant labels
  text = text
    .replace(/Problem ID:\s*\d+/gi, '')
    .replace(/Host:\s*/gi, '')
    .replace(/Duration:\s*/gi, '')
    .trim();

  return text.substring(0, 500); // Limit length
}

/**
 * Extract duration in seconds
 */
function extractDuration($, $row, cells) {
  const text = $row.text();

  // Look for duration patterns
  const patterns = [
    /Duration:\s*(\d+)h\s*(\d+)m/i,
    /Duration:\s*(\d+)m/i,
    /Duration:\s*(\d+)s/i,
    /(\d+)\s*hours/i,
    /(\d+)\s*minutes/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      if (pattern.source.includes('h')) {
        return parseInt(match[1]) * 3600 + parseInt(match[2] || 0) * 60;
      } else if (pattern.source.includes('m')) {
        return parseInt(match[1]) * 60;
      } else {
        return parseInt(match[1]);
      }
    }
  }

  return 0;
}

/**
 * Extract provider/vendor
 */
function extractProvider($, $row, cells) {
  const text = $row.text();

  const providers = ['Cisco', 'Juniper', 'Arista', 'HP', 'Dell', 'Huawei', 'Nokia', 'Ericsson'];

  for (const provider of providers) {
    if (text.toLowerCase().includes(provider.toLowerCase())) {
      return provider;
    }
  }

  return null;
}

/**
 * Check if string is a valid date
 */
function isValidDate(dateString) {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
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

  const hosts = [...new Set(alerts.map(a => a.host))];

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

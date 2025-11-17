import express from 'express';
import {
  getTotalAlerts,
  getAlertsLastNDays,
  getAlertsByHost,
  getActiveAlerts,
  getRecentAlerts,
} from '../services/supabase.js';

const router = express.Router();

/**
 * GET /api/stats/total - Get total alert count
 */
router.get('/total', async (req, res) => {
  try {
    const total = await getTotalAlerts();
    res.json({ total });
  } catch (error) {
    console.error('Error getting total alerts:', error);
    res.status(500).json({ error: 'Failed to get total alerts' });
  }
});

/**
 * GET /api/stats/last-n-days - Get alerts from last N days
 */
router.get('/last-n-days', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 2;
    const alerts = await getAlertsLastNDays(days);

    // Calculate statistics
    const stats = {
      total: alerts.length,
      active: alerts.filter(a => a.status === 'PROBLEM').length,
      resolved: alerts.filter(a => a.status !== 'PROBLEM').length,
      bySeverity: {},
      byType: {},
    };

    // Group by severity
    alerts.forEach(alert => {
      const severity = alert.severity || 'UNKNOWN';
      stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
    });

    // Group by alert type
    alerts.forEach(alert => {
      const type = alert.alert_type || 'UNKNOWN';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    });

    res.json({ days, stats, alerts: alerts.slice(0, 50) });
  } catch (error) {
    console.error('Error getting last N days alerts:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * GET /api/stats/by-host - Get alert statistics grouped by host
 */
router.get('/by-host', async (req, res) => {
  try {
    const hostStats = await getAlertsByHost();
    res.json({ hosts: hostStats });
  } catch (error) {
    console.error('Error getting alerts by host:', error);
    res.status(500).json({ error: 'Failed to get host statistics' });
  }
});

/**
 * GET /api/stats/active - Get active/unresolved alerts
 */
router.get('/active', async (req, res) => {
  try {
    const activeAlerts = await getActiveAlerts();
    res.json({
      count: activeAlerts.length,
      alerts: activeAlerts.slice(0, 100),
    });
  } catch (error) {
    console.error('Error getting active alerts:', error);
    res.status(500).json({ error: 'Failed to get active alerts' });
  }
});

/**
 * GET /api/stats/recent - Get recent alerts
 */
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const recentAlerts = await getRecentAlerts(limit);
    res.json({
      count: recentAlerts.length,
      alerts: recentAlerts,
    });
  } catch (error) {
    console.error('Error getting recent alerts:', error);
    res.status(500).json({ error: 'Failed to get recent alerts' });
  }
});

/**
 * GET /api/stats/summary - Get overall dashboard summary
 */
router.get('/summary', async (req, res) => {
  try {
    const [total, recent, active, hostStats] = await Promise.all([
      getTotalAlerts(),
      getRecentAlerts(10),
      getActiveAlerts(),
      getAlertsByHost(),
    ]);

    const summary = {
      totalAlerts: total,
      activeAlerts: active.length,
      resolvedAlerts: total - active.length,
      topHosts: hostStats.slice(0, 10),
      recentAlerts: recent,
      lastUpdated: new Date().toISOString(),
    };

    res.json(summary);
  } catch (error) {
    console.error('Error getting summary:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

export default router;

import { useState, useEffect } from 'react';

function Dashboard({ stats, loading }) {
  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading statistics...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="dashboard">
        <div className="error">Failed to load statistics</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <h2 className="section-title">Dashboard</h2>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalAlerts?.toLocaleString() || 0}</div>
            <div className="stat-label">Total Alerts</div>
          </div>
        </div>

        <div className="stat-card alert">
          <div className="stat-icon">🔴</div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeAlerts?.toLocaleString() || 0}</div>
            <div className="stat-label">Active Problems</div>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.resolvedAlerts?.toLocaleString() || 0}</div>
            <div className="stat-label">Resolved</div>
          </div>
        </div>
      </div>

      {/* Top Hosts */}
      <div className="top-hosts">
        <h3 className="subsection-title">Top Hosts by Alerts</h3>
        <div className="hosts-list">
          {stats.topHosts?.slice(0, 5).map((host, index) => (
            <div key={index} className="host-item">
              <div className="host-info">
                <span className="host-rank">#{index + 1}</span>
                <span className="host-name">{host.host}</span>
              </div>
              <div className="host-stats">
                <span className="host-total">{host.total}</span>
                {host.active > 0 && (
                  <span className="host-active">🔴 {host.active}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="recent-alerts">
        <h3 className="subsection-title">Recent Alerts</h3>
        <div className="alerts-list">
          {stats.recentAlerts?.slice(0, 10).map((alert, index) => (
            <div
              key={index}
              className={`alert-item ${alert.status === 'PROBLEM' ? 'problem' : 'resolved'}`}
            >
              <div className="alert-header">
                <span className={`alert-status ${alert.status?.toLowerCase()}`}>
                  {alert.status === 'PROBLEM' ? '🔴' : '✅'} {alert.status}
                </span>
                <span className="alert-time">
                  {new Date(alert.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="alert-details">
                <div className="alert-host">
                  <strong>{alert.host}</strong>
                  {alert.interface && <span> - {alert.interface}</span>}
                </div>
                <div className="alert-type">{alert.alert_type}</div>
                {alert.severity && (
                  <span className={`severity-badge ${alert.severity?.toLowerCase()}`}>
                    {alert.severity}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

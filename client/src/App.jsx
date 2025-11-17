import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import ChatBox from './components/ChatBox';
import UploadModal from './components/UploadModal';
import UploadHistory from './components/UploadHistory';

function App() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);
  const [activeView, setActiveView] = useState('chat'); // 'chat' or 'dashboard'
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch dashboard summary
  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stats/summary');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch upload history
  const fetchUploadHistory = async () => {
    try {
      const response = await fetch('/api/upload/history');
      const data = await response.json();
      setUploadHistory(data.history || []);
    } catch (error) {
      console.error('Error fetching upload history:', error);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchUploadHistory();
  }, []);

  const handleUploadComplete = () => {
    setShowUploadModal(false);
    fetchStats();
    fetchUploadHistory();
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-logo">📊 Altima</h2>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {sidebarOpen && (
          <>
            <nav className="sidebar-nav">
              <button
                className={`nav-item ${activeView === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveView('chat')}
              >
                <span className="nav-icon">💬</span>
                <span className="nav-label">AI Chat</span>
              </button>
              <button
                className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveView('dashboard')}
              >
                <span className="nav-icon">📈</span>
                <span className="nav-label">Dashboard</span>
              </button>
              <button
                className="nav-item"
                onClick={() => setShowUploadModal(true)}
              >
                <span className="nav-icon">📤</span>
                <span className="nav-label">Upload Data</span>
              </button>
            </nav>

            {/* Stats Summary in Sidebar */}
            <div className="sidebar-stats">
              <h3 className="sidebar-section-title">Quick Stats</h3>
              <div className="sidebar-stat">
                <span className="sidebar-stat-label">Total Alerts</span>
                <span className="sidebar-stat-value">{stats?.totalAlerts?.toLocaleString() || 0}</span>
              </div>
              <div className="sidebar-stat alert">
                <span className="sidebar-stat-label">Active</span>
                <span className="sidebar-stat-value">{stats?.activeAlerts?.toLocaleString() || 0}</span>
              </div>
              <div className="sidebar-stat success">
                <span className="sidebar-stat-label">Resolved</span>
                <span className="sidebar-stat-value">{stats?.resolvedAlerts?.toLocaleString() || 0}</span>
              </div>
            </div>

            {/* Upload History in Sidebar */}
            <div className="sidebar-history">
              <h3 className="sidebar-section-title">Recent Uploads</h3>
              {uploadHistory.slice(0, 3).map((upload, idx) => (
                <div key={idx} className="sidebar-history-item">
                  <div className="sidebar-history-name">{upload.filename}</div>
                  <div className="sidebar-history-count">+{upload.records_added} alerts</div>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="app-header">
          <div className="header-content">
            <h1 className="page-title">
              {activeView === 'chat' ? 'AI Chat Assistant' : 'Network Dashboard'}
            </h1>
            <button
              className="upload-button"
              onClick={() => setShowUploadModal(true)}
            >
              📤 Upload
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="content-area">
          {activeView === 'chat' ? (
            <ChatBox />
          ) : (
            <div className="dashboard-view">
              <Dashboard stats={stats} loading={loading} />
              <UploadHistory history={uploadHistory} />
            </div>
          )}
        </div>
      </main>

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onComplete={handleUploadComplete}
        />
      )}
    </div>
  );
}

export default App;

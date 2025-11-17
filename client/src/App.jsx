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
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="app-title">Network Monitoring Analytics</h1>
            {stats && (
              <p className="database-info">
                Database: {stats.totalAlerts?.toLocaleString() || 0} alerts
              </p>
            )}
          </div>
          <button
            className="upload-button"
            onClick={() => setShowUploadModal(true)}
          >
            📤 Upload New Data
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="app-content">
        <div className="left-panel">
          <Dashboard stats={stats} loading={loading} />
          <UploadHistory history={uploadHistory} />
        </div>

        <div className="right-panel">
          <ChatBox />
        </div>
      </div>

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

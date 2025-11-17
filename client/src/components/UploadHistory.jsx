function UploadHistory({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="upload-history">
        <h3 className="subsection-title">Upload History</h3>
        <p className="empty-message">No uploads yet. Upload your first file!</p>
      </div>
    );
  }

  return (
    <div className="upload-history">
      <h3 className="subsection-title">Upload History</h3>
      <div className="history-list">
        {history.map((upload, index) => (
          <div key={index} className="history-item">
            <div className="history-header">
              <span className="history-filename">{upload.filename}</span>
              <span className={`history-status ${upload.status}`}>
                {upload.status === 'completed' ? '✅' : '❌'}
              </span>
            </div>
            <div className="history-details">
              <div className="history-stat">
                <span className="history-label">Date:</span>
                <span className="history-value">
                  {new Date(upload.upload_date).toLocaleString()}
                </span>
              </div>
              <div className="history-stat">
                <span className="history-label">Added:</span>
                <span className="history-value success">
                  {upload.records_added}
                </span>
              </div>
              <div className="history-stat">
                <span className="history-label">Skipped:</span>
                <span className="history-value">{upload.records_skipped}</span>
              </div>
              <div className="history-stat">
                <span className="history-label">Total:</span>
                <span className="history-value">{upload.records_count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UploadHistory;

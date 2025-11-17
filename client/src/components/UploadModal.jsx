import { useState, useRef } from 'react';

function UploadModal({ onClose, onComplete }) {
  const [files, setFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'text/html' || file.name.endsWith('.html')
    );

    if (droppedFiles.length > 0) {
      setFiles(droppedFiles);
      analyzeFiles(droppedFiles);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    analyzeFiles(selectedFiles);
  };

  const analyzeFiles = async (filesToAnalyze) => {
    if (filesToAnalyze.length === 0) return;

    try {
      const formData = new FormData();
      formData.append('file', filesToAnalyze[0]);

      const response = await fetch('/api/upload/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setPreview(data);
    } catch (error) {
      console.error('Error analyzing files:', error);
      alert('Error analyzing files. Please try again.');
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(10);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      setUploadProgress(30);

      const response = await fetch('/api/upload/process', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(70);

      const data = await response.json();

      setUploadProgress(100);
      setUploadResult(data);

      // Auto-close and refresh after success
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Error uploading files. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Upload Network Monitoring Data</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {!uploadResult ? (
            <>
              {/* File Drop Zone */}
              <div
                className={`file-drop-zone ${dragActive ? 'active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".html"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <div className="drop-zone-content">
                  <div className="drop-zone-icon">📁</div>
                  <h3>Drop HTML files here</h3>
                  <p>or click to browse</p>
                  <p className="drop-zone-hint">
                    Accepts .html files (max 10 files, 10MB each)
                  </p>
                </div>
              </div>

              {/* Selected Files */}
              {files.length > 0 && (
                <div className="selected-files">
                  <h3>Selected Files</h3>
                  {files.map((file, index) => (
                    <div key={index} className="file-item">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">
                        {(file.size / 1024).toFixed(2)} KB
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview */}
              {preview && (
                <div className="upload-preview">
                  <h3>Preview</h3>
                  <div className="preview-stats">
                    <div className="preview-stat">
                      <span className="preview-label">Total Messages:</span>
                      <span className="preview-value">{preview.totalMessages}</span>
                    </div>
                    <div className="preview-stat">
                      <span className="preview-label">New Alerts:</span>
                      <span className="preview-value success">
                        {preview.newAlerts}
                      </span>
                    </div>
                    <div className="preview-stat">
                      <span className="preview-label">Duplicates:</span>
                      <span className="preview-value warning">
                        {preview.duplicatesFound}
                      </span>
                    </div>
                    <div className="preview-stat">
                      <span className="preview-label">Hosts Found:</span>
                      <span className="preview-value">{preview.hostsCount}</span>
                    </div>
                    {preview.dateRange?.start && (
                      <div className="preview-stat full-width">
                        <span className="preview-label">Date Range:</span>
                        <span className="preview-value">
                          {new Date(preview.dateRange.start).toLocaleDateString()} -{' '}
                          {new Date(preview.dateRange.end).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                  {preview.duplicatesFound > 0 && (
                    <div className="preview-warning">
                      ⚠️ {preview.duplicatesFound} duplicate alert(s) will be skipped
                    </div>
                  )}
                </div>
              )}

              {/* Upload Progress */}
              {uploading && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="progress-text">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}
            </>
          ) : (
            /* Upload Result */
            <div className="upload-result">
              <div className="result-icon success">✅</div>
              <h3>Upload Complete!</h3>
              <div className="result-stats">
                <div className="result-stat">
                  <span className="result-label">Files Processed:</span>
                  <span className="result-value">
                    {uploadResult.summary?.filesProcessed}
                  </span>
                </div>
                <div className="result-stat">
                  <span className="result-label">Records Added:</span>
                  <span className="result-value success">
                    {uploadResult.summary?.recordsAdded}
                  </span>
                </div>
                <div className="result-stat">
                  <span className="result-label">Records Skipped:</span>
                  <span className="result-value">
                    {uploadResult.summary?.recordsSkipped}
                  </span>
                </div>
                <div className="result-stat">
                  <span className="result-label">Total Alerts:</span>
                  <span className="result-value">
                    {uploadResult.summary?.totalAlerts}
                  </span>
                </div>
              </div>
              <p className="result-message">Dashboard will refresh automatically...</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {!uploadResult && (
            <>
              <button
                className="btn btn-secondary"
                onClick={onClose}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={files.length === 0 || uploading}
              >
                {uploading ? 'Uploading...' : 'Upload & Process'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default UploadModal;

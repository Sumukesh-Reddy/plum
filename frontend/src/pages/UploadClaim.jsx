import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimApi } from '../api/claimApi';

export default function UploadClaim() {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const addFiles = (newFiles) => {
    const allowed = Array.from(newFiles).filter(f =>
      ['image/jpeg','image/jpg','image/png','application/pdf'].includes(f.type)
    );
    setFiles(prev => [...prev, ...allowed]);
    if (allowed.length < newFiles.length) setError('Only PDF, JPG, PNG files are accepted.');
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (files.length === 0) { setError('Please upload at least one document.'); return; }
    setError(null);
    setLoading(true);
    try {
      const result = await claimApi.createClaim(files);
      const claimId = result.data?.claimId || result.claimId;
      navigate(`/result/${claimId}`, { state: { result: result.data || result } });
    } catch (err) {
      setError(err.message || 'Failed to process claim. Please try again.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <span>Processing claim — this may take up to 30 seconds...</span>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 className="page-title">Submit OPD Claim</h1>
      <p className="page-subtitle">Upload your medical documents for adjudication</p>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Dropzone */}
      <div
        className={`dropzone ${dragging ? 'active' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => document.getElementById('file-input').click()}
      >
        <div className="dropzone-icon">📄</div>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>Drag & drop files here, or click to browse</p>
        <p style={{ fontSize: 12, color: '#aaa' }}>PDF, JPG, PNG — max 10 MB each</p>
        <input
          id="file-input"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          style={{ display: 'none' }}
          onChange={e => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <ul className="file-list">
          {files.map((f, i) => (
            <li className="file-item" key={i}>
              <span>📎 {f.name} <span style={{ color: '#aaa' }}>({(f.size/1024).toFixed(0)} KB)</span></span>
              <button
                className="btn btn-danger"
                style={{ padding: '2px 10px', fontSize: 12 }}
                onClick={() => removeFile(i)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Accepted types */}
      <div className="card" style={{ marginTop: 16 }}>
        <strong style={{ fontSize: 13 }}>Accepted Documents</strong>
        <ul style={{ marginTop: 8, paddingLeft: 18, color: '#555', fontSize: 13, lineHeight: 1.8 }}>
          <li>Doctor Prescription</li>
          <li>Medical Bills / Invoices</li>
          <li>Pharmacy Receipts</li>
          <li>Diagnostic Reports</li>
          <li>Lab Test Reports</li>
        </ul>
      </div>

      <button
        className="btn btn-primary"
        style={{ width: '100%', padding: '12px', fontSize: 15, marginTop: 4 }}
        onClick={handleSubmit}
        disabled={files.length === 0}
        id="submit-claim-btn"
      >
        {files.length > 0 ? `Analyze ${files.length} Document${files.length > 1 ? 's' : ''}` : 'Upload Documents to Continue'}
      </button>
    </div>
  );
}

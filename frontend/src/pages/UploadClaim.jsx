import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileImage, FileText, Info, ShieldCheck, Trash2, UploadCloud, ClipboardList } from 'lucide-react';
import { claimApi } from '../api/claimApi';

export default function UploadClaim() {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [errorStep, setErrorStep] = useState(null);
  const [processingError, setProcessingError] = useState(null);
  const [policy, setPolicy] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    claimApi.getPolicy()
      .then(res => {
        if (res.success) setPolicy(res.data);
      })
      .catch(console.error);
  }, []);

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
    setLoadingStep(0);
    setErrorStep(null);
    setProcessingError(null);

    // Simulate progress updates
    let step = 0;
    const interval = setInterval(() => {
      if (step < 3) {
        step++;
        setLoadingStep(step);
      }
    }, 1200);

    try {
      const result = await claimApi.createClaim(files);
      clearInterval(interval);
      setLoadingStep(4); // anti-fraud / verification step
      
      setTimeout(() => {
        const claimId = result.data?.claimId || result.claimId;
        navigate(`/result/${claimId}`, { state: { result: result.data || result } });
      }, 800);
    } catch (err) {
      clearInterval(interval);
      // Guess failed step based on error text
      let failedStepIdx = 1;
      const errMsg = (err.message || '').toLowerCase();
      if (errMsg.includes('upload') || errMsg.includes('multipart') || errMsg.includes('file size')) {
        failedStepIdx = 0;
      } else if (errMsg.includes('adjudic') || errMsg.includes('rule') || errMsg.includes('policy')) {
        failedStepIdx = 3;
      } else if (errMsg.includes('patient') || errMsg.includes('doctor') || errMsg.includes('license') || errMsg.includes('registration')) {
        failedStepIdx = 2;
      }
      
      setErrorStep(failedStepIdx);
      setLoadingStep(failedStepIdx);
      setProcessingError(err.message || 'Processing failed. Please check the document legibility.');
    }
  };

  const processingSteps = [
    { label: 'Uploading document files...', idx: 0 },
    { label: 'Running AI OCR Text Extraction...', idx: 1 },
    { label: 'Validating Patient & Doctor Credentials...', idx: 2 },
    { label: 'Executing Rules Engine checks (If-Else gates)...', idx: 3 },
    { label: 'Verifying Anti-Fraud & Duplicate Claims...', idx: 4 }
  ];

  if (loading) {
    const isError = errorStep !== null;
    return (
      <div className="loading-overlay" style={{ backgroundColor: 'rgba(255, 255, 255, 0.96)', transition: 'opacity 0.2s ease-in-out' }}>
        <div 
          className="card" 
          style={{ 
            width: '100%', 
            maxWidth: '460px', 
            padding: '24px', 
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: isError ? '1px solid #fecaca' : '1px solid #e5e7eb',
            backgroundColor: '#ffffff'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            {isError ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                fontSize: '22px',
                fontWeight: 'bold',
                marginBottom: '12px'
              }}>
                ⚠️
              </div>
            ) : (
              <div className="spinner" style={{ margin: '0 auto 12px', width: '36px', height: '36px' }}></div>
            )}
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
              {isError ? 'Processing Terminated' : 'Adjudicating OPD Claim...'}
            </h3>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: 4 }}>
              {isError ? 'Claims engine encountered an execution error' : 'Analyzing document photos & parsing claims data'}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
            {processingSteps.map((step) => {
              const stepIdx = step.idx;
              const isCompleted = loadingStep > stepIdx && !isError;
              const isCurrent = loadingStep === stepIdx && !isError;
              const isPending = loadingStep < stepIdx;
              const isFailedStep = isError && errorStep === stepIdx;
              const isPastBeforeFail = isError && stepIdx < errorStep;

              let iconBg = '#ffffff';
              let iconBorder = '2px solid #d1d5db';
              let iconColor = '#9ca3af';
              let iconContent = '';
              let labelColor = '#6b7280';
              let labelWeight = 'normal';

              if (isCompleted || isPastBeforeFail) {
                iconBg = '#16a34a';
                iconBorder = 'none';
                iconColor = '#ffffff';
                iconContent = '✓';
                labelColor = '#111827';
              } else if (isCurrent) {
                iconBg = '#eff6ff';
                iconBorder = 'none';
                iconColor = '#1d4ed8';
                labelColor = '#1d4ed8';
                labelWeight = 'bold';
              } else if (isFailedStep) {
                iconBg = '#dc2626';
                iconBorder = 'none';
                iconColor = '#ffffff';
                iconContent = '✗';
                labelColor = '#dc2626';
                labelWeight = 'bold';
              }

              return (
                <div key={stepIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: iconBg,
                      border: iconBorder,
                      color: iconColor,
                      fontSize: '12px',
                      fontWeight: '900',
                      flexShrink: 0
                    }}>
                      {isCurrent ? (
                        <div className="spinner" style={{ width: '10px', height: '10px', borderWidth: '2px', borderTopColor: '#1d4ed8' }}></div>
                      ) : iconContent}
                    </div>
                    <span style={{ fontSize: '13px', color: labelColor, fontWeight: labelWeight }}>
                      {step.label}
                    </span>
                  </div>

                  {isFailedStep && processingError && (
                    <div style={{
                      marginLeft: 34,
                      marginTop: 4,
                      fontSize: '11px',
                      color: '#b91c1c',
                      backgroundColor: '#fef2f2',
                      padding: '8px 12px',
                      borderRadius: '4px',
                      border: '1px solid #fca5a5',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {processingError}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isError && (
            <button
              onClick={() => {
                setLoading(false);
                setError(processingError);
              }}
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: 24, display: 'block', padding: '10px' }}
            >
              Go Back & Edit Uploads
            </button>
          )}
        </div>
      </div>
    );
  }

  const totalSizeMb = files.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024);
  const hasPrescriptionLike = files.some(file => /prescription|rx|doctor/i.test(file.name));
  const hasBillLike = files.some(file => /bill|invoice|receipt|pharmacy/i.test(file.name));

  return (
    <div className="upload-layout">
      <div className="upload-main">
        <h1 className="page-title">Submit OPD Claim</h1>
        <p className="page-subtitle">Upload prescriptions, bills, and reports for AI-assisted adjudication</p>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Dropzone */}
        <div
          className={`dropzone ${dragging ? 'active' : ''}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => document.getElementById('file-input').click()}
        >
          <UploadCloud size={42} strokeWidth={1.8} />
          <p style={{ fontWeight: 700, marginBottom: 4 }}>Drop files here or click to browse</p>
          <p style={{ fontSize: 12, color: '#64748b' }}>PDF, JPG, PNG. Upload a prescription and bill together for best results.</p>
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
          <div className="file-panel">
            <div className="section-header">
              <span className="section-title">Selected Documents</span>
              <span className="muted-text">{files.length} files, {totalSizeMb.toFixed(1)} MB</span>
            </div>
            <ul className="file-list">
              {files.map((f, i) => {
                const isPdf = f.type === 'application/pdf';
                const FileIcon = isPdf ? FileText : FileImage;
                return (
                  <li className="file-item" key={`${f.name}-${i}`}>
                    <span className="file-meta">
                      <FileIcon size={18} />
                      <span>
                        <strong>{f.name}</strong>
                        <small>{f.type || 'Document'} · {(f.size/1024).toFixed(0)} KB</small>
                      </span>
                    </span>
                    <button
                      className="btn btn-danger icon-btn"
                      onClick={() => removeFile(i)}
                      title="Remove file"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: 15, marginTop: 14 }}
          onClick={handleSubmit}
          disabled={files.length === 0}
          id="submit-claim-btn"
        >
          <ShieldCheck size={17} />
          {files.length > 0 ? `Analyze ${files.length} Document${files.length > 1 ? 's' : ''}` : 'Upload Documents to Continue'}
        </button>
      </div>

      <aside className="upload-side">
        {policy && (
          <div className="card" style={{ borderTop: '4px solid #2563eb' }}>
            <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <ClipboardList size={16} />
              Active Policy Reference
            </div>
            <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: '#111827', borderBottom: '1px solid #eee', paddingBottom: 4, marginBottom: 6 }}>
                {policy.policy_name || 'Standard OPD Policy'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#64748b' }}>Per-Claim Limit:</span>
                <strong style={{ color: '#111827' }}>₹{policy.coverage_details?.per_claim_limit?.toLocaleString('en-IN') || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#64748b' }}>Consultation Copay:</span>
                <strong style={{ color: '#111827' }}>{policy.coverage_details?.consultation_fees?.copay_percentage || 0}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#64748b' }}>Network Discount:</span>
                <strong style={{ color: '#111827' }}>{policy.coverage_details?.consultation_fees?.network_discount || 0}%</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ color: '#64748b' }}>Waiting Period:</span>
                <strong style={{ color: '#111827' }}>{policy.waiting_periods?.initial_waiting || 0} days</strong>
              </div>
              {policy.exclusions?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontWeight: 600, color: '#475569', marginBottom: 2 }}>Key Exclusions:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {policy.exclusions.slice(0, 3).map((ex, idx) => (
                      <span key={idx} style={{ background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: 10 }}>
                        {ex}
                      </span>
                    ))}
                    {policy.exclusions.length > 3 && <span style={{ fontSize: 10, color: '#888' }}>+{policy.exclusions.length - 3} more</span>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="card">
          <div className="section-title">Claim Readiness</div>
          <div className="check-row good">
            <ShieldCheck size={16} />
            <span>PDF, JPG, PNG supported</span>
          </div>
          <div className={`check-row ${hasPrescriptionLike ? 'good' : ''}`}>
            <FileText size={16} />
            <span>Prescription included</span>
          </div>
          <div className={`check-row ${hasBillLike ? 'good' : ''}`}>
            <FileText size={16} />
            <span>Bill or receipt included</span>
          </div>
          <div className="hint-box">
            <Info size={16} />
            <span>Gemini runs once per image, so upload only the documents needed for the case while testing quota.</span>
          </div>
        </div>

        <div className="card">
          <div className="section-title">Accepted Documents</div>
          <div className="doc-chip-list">
            <span>Doctor prescription</span>
            <span>Medical bill</span>
            <span>Pharmacy receipt</span>
            <span>Diagnostic report</span>
            <span>Lab test report</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

import { useLocation, useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, FileText, IndianRupee, ShieldCheck, XCircle, Printer, Copy, ExternalLink, Eye } from 'lucide-react';
import { claimApi, API_BASE } from '../api/claimApi';

const decisionClass = (d) => {
  if (d === 'APPROVED')      return 'decision-approved';
  if (d === 'REJECTED')      return 'decision-rejected';
  if (d === 'PARTIAL')       return 'decision-partial';
  return 'decision-manual';
};

const decisionLabel = (d) => {
  if (d === 'APPROVED')      return 'Claim Approved';
  if (d === 'REJECTED')      return 'Claim Rejected';
  if (d === 'PARTIAL')       return 'Partial Approval';
  return 'Manual Review Required';
};

const DecisionIcon = ({ decision }) => {
  if (decision === 'APPROVED') return <CheckCircle2 size={24} />;
  if (decision === 'REJECTED') return <XCircle size={24} />;
  if (decision === 'PARTIAL') return <AlertTriangle size={24} />;
  return <Clock3 size={24} />;
};

const Field = ({ label, value }) => (
  <div className="data-field">
    <label>{label}</label>
    <span>{value || '—'}</span>
  </div>
);

export default function ClaimResult() {
  const location = useLocation();
  const { id } = useParams();
  const [claimData, setClaimData] = useState(location.state?.result || null);
  const [loading, setLoading] = useState(!claimData);

  // Manual Review Form State
  const [reviewDecision, setReviewDecision] = useState('APPROVED');
  const [overrideAmount, setOverrideAmount] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  // Document preview and clipboard copy states
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  // Initialize override amount when claimData is loaded
  useEffect(() => {
    if (claimData) {
      const adj = claimData.adjudication || claimData.decision;
      const ext = claimData.extracted || claimData.extractedData;
      setOverrideAmount(adj?.approvedAmount || adj?.approved_amount || ext?.bill_amount || 0);
    }
  }, [claimData]);

  useEffect(() => {
    if (location.state?.result && id === location.state.result.claimId) {
      setClaimData(location.state.result);
      setLoading(false);
    } else if (id) {
      setLoading(true);
      claimApi.getClaim(id)
        .then(res => setClaimData(res.data || res))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id, location.state]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const claimId = claimData.claimId;
      const res = await claimApi.overrideClaim(
        claimId,
        reviewDecision,
        reviewDecision === 'APPROVED' ? Number(overrideAmount) : 0,
        reviewerNotes || 'Manual adjudication review override'
      );
      if (res.success && res.data) {
        setClaimData(res.data);
        setReviewerNotes('');
      } else {
        setReviewError('Failed to update decision');
      }
    } catch (err) {
      setReviewError(err.message || 'An error occurred during review override');
    } finally {
      setSubmittingReview(false);
    }
  };

  const copySummaryToClipboard = () => {
    const adj = claimData.adjudication || claimData.decision;
    const ext = claimData.extracted || claimData.extractedData;
    const summaryText = `### Plum Claims Adjudication Report
- **Claim ID**: ${claimData.claimId}
- **Patient Name**: ${ext?.patient_name || claimData.patientName || 'Unknown'}
- **Diagnosis**: ${ext?.diagnosis || claimData.diagnosis || '—'}
- **Hospital/Clinic**: ${ext?.hospital_name || claimData.hospitalName || '—'}
- **Claimed Amount**: ₹${(ext?.bill_amount || claimData.billAmount || 0).toLocaleString('en-IN')}
- **Approved Amount**: ₹${(adj?.approved_amount ?? adj?.approvedAmount ?? 0).toLocaleString('en-IN')}
- **Status Decision**: ${adj?.decision}
- **Rejection Reasons**: ${adj?.rejection_reasons?.join(', ') || 'None'}
- **Clinical/Admin Notes**: ${adj?.notes?.join('; ') || 'None'}`;

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 0', color: '#888' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
        <p style={{ textAlign: 'center' }}>Loading claim...</p>
      </div>
    );
  }

  if (!claimData) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: '#888' }}>
        <p>Claim not found.</p>
        <Link to="/upload"><button className="btn btn-primary" style={{ marginTop: 12 }}>Submit New Claim</button></Link>
      </div>
    );
  }

  const adjudication = claimData.adjudication || claimData.decision;
  const extracted    = claimData.extracted    || claimData.extractedData;
  const decision     = adjudication?.decision;
  const processingMs = claimData.processingTime || 0;
  const validationSteps = adjudication?.validation_steps || adjudication?.validationSteps || [];
  const approvedAmount = adjudication?.approved_amount ?? adjudication?.approvedAmount ?? 0;
  const claimedAmount = extracted?.bill_amount || claimData.billAmount || 0;
  const confidence = adjudication?.confidence_score ?? adjudication?.confidenceScore;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <Link to="/history" className="back-link">
          <ArrowLeft size={15} />
          Back to History
        </Link>
        <div style={{ display: 'flex', gap: 8 }} className="no-print">
          <button 
            className="btn btn-secondary" 
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} />
            Print Report
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={copySummaryToClipboard}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Copy size={15} />
            {copied ? 'Copied!' : 'Copy Summary'}
          </button>
        </div>
      </div>

      <h1 className="page-title">Claim Adjudication Report</h1>
      <p className="page-subtitle" style={{ fontFamily: 'monospace' }}>
        {claimData.claimId}
        {processingMs > 0 && <span style={{ marginLeft: 12, color: '#aaa' }}>({(processingMs/1000).toFixed(1)}s processing time)</span>}
      </p>

      {/* Process Timeline */}
      <div className="card no-print" style={{ padding: '16px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', position: 'relative' }}>
          {[
            { label: 'Submitted', desc: 'Claim received', active: true },
            { label: 'OCR Processed', desc: 'Text extracted', active: !!extracted },
            { label: 'Verified', desc: 'Checks validated', active: validationSteps.length > 0 },
            { label: 'Adjudicated', desc: 'AI Decision', active: !!decision },
            { label: 'Settled', desc: decision === 'APPROVED' || decision === 'REJECTED' || confidence === 1 ? 'Finalized' : 'Needs Review', active: decision !== 'MANUAL_REVIEW', warn: decision === 'MANUAL_REVIEW' }
          ].map((step, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative', zIndex: 2 }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: step.warn ? '#fffbeb' : (step.active ? '#f0fdf4' : '#f3f4f6'),
                border: `2px solid ${step.warn ? '#d97706' : (step.active ? '#10b981' : '#cbd5e1')}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 'bold',
                color: step.warn ? '#d97706' : (step.active ? '#10b981' : '#6b7280')
              }}>
                {step.warn ? '!' : (step.active ? '✓' : idx + 1)}
              </div>
              <span style={{ fontSize: 11, fontWeight: 'bold', marginTop: 4, color: '#374151' }}>{step.label}</span>
              <span style={{ fontSize: 9, color: '#6b7280' }}>{step.desc}</span>
            </div>
          ))}
          {/* Background line */}
          <div style={{
            position: 'absolute',
            top: 12,
            left: '10%',
            right: '10%',
            height: 2,
            backgroundColor: '#e5e7eb',
            zIndex: 1
          }} />
        </div>
      </div>

      {/* Duplicate warning banner */}
      {extracted?.is_duplicate && (
        <div 
          className="alert" 
          style={{ 
            marginBottom: 20, 
            backgroundColor: '#fffbeb', 
            border: '2px dashed #d97706', 
            borderRadius: '6px',
            color: '#b45309',
            padding: '16px',
            fontSize: '14px',
            lineHeight: '1.5'
          }}
        >
          <strong>⚠️ POTENTIAL DUPLICATE DETECTED:</strong> A claim with the identical patient name, treatment date, and bill amount already exists in the database.
          <div style={{ marginTop: 8 }}>
            <strong>Matching Claim ID:</strong>{' '}
            <Link 
              to={`/claims/${extracted.duplicate_claim_id}`} 
              style={{ color: '#b45309', fontWeight: 'bold', textDecoration: 'underline' }}
            >
              {extracted.duplicate_claim_id}
            </Link>
          </div>
        </div>
      )}

      {/* Split Layout for Preview Side Panel */}
      <div className="upload-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '20px', alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          {/* Decision */}
          {adjudication && (
            <div className={`decision-section ${decisionClass(decision)}`}>
              <div className="decision-header">
                <div className="decision-title">
                  <DecisionIcon decision={decision} />
                  {decisionLabel(decision)}
                </div>
                {confidence != null && (
                  <span className="confidence-pill">{Math.round(confidence * 100)}% confidence</span>
                )}
              </div>

              <div className="result-summary-grid">
                <div className="result-summary-item">
                  <FileText size={18} />
                  <span>Claimed</span>
                  <strong>{claimedAmount > 0 ? `₹${claimedAmount.toLocaleString('en-IN')}` : '—'}</strong>
                </div>
                <div className="result-summary-item">
                  <IndianRupee size={18} />
                  <span>Approved</span>
                  <strong>{approvedAmount > 0 ? `₹${approvedAmount.toLocaleString('en-IN')}` : '₹0'}</strong>
                </div>
                <div className="result-summary-item">
                  <ShieldCheck size={18} />
                  <span>Status</span>
                  <strong>{decision?.replace('_', ' ') || '—'}</strong>
                </div>
                <div className="result-summary-item">
                  <Clock3 size={18} />
                  <span>Processing</span>
                  <strong>{processingMs > 0 ? `${(processingMs / 1000).toFixed(1)}s` : '—'}</strong>
                </div>
              </div>

              {approvedAmount > 0 && (
                <div style={{ margin: '12px 0' }}>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>Approved Amount</div>
                  <div className="amount-display">₹{approvedAmount.toLocaleString('en-IN')}</div>
                  {adjudication.original_amount && adjudication.original_amount !== approvedAmount && (
                    <div style={{ fontSize: 12, color: '#888' }}>Claimed: ₹{adjudication.original_amount.toLocaleString('en-IN')}</div>
                  )}
                </div>
              )}

              {adjudication.rejection_reasons?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Rejection Reasons</div>
                  <ul style={{ paddingLeft: 18, fontSize: 13, color: '#b91c1c', lineHeight: 1.8 }}>
                    {adjudication.rejection_reasons.map((r, i) => <li key={i}>{r.replace(/_/g, ' ')}</li>)}
                  </ul>
                </div>
              )}

              {adjudication.notes?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>Notes</div>
                  <ul style={{ paddingLeft: 18, fontSize: 13, color: '#444', lineHeight: 1.8 }}>
                    {adjudication.notes.map((n, i) => <li key={i}>{n}</li>)}
                  </ul>
                </div>
              )}

              {adjudication.next_steps && (
                <div style={{ marginTop: 10, fontSize: 13, color: '#555' }}>
                  <strong>Next Steps: </strong>{adjudication.next_steps}
                </div>
              )}
            </div>
          )}

          {/* Admin Manual Review Panel */}
          {decision === 'MANUAL_REVIEW' && (
            <div className="card" style={{ border: '2px solid #2563eb', backgroundColor: '#eff6ff', margin: '20px 0' }}>
              <div className="section-title" style={{ color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 8 }}>
                🛡️ Admin Manual Review Panel
              </div>
              <p style={{ fontSize: 13, color: '#1e40af', marginBottom: 16 }}>
                This claim requires manual review. As an administrator, you can override the AI decision below.
              </p>

              {reviewError && <div className="alert alert-error" style={{ marginBottom: 16 }}>{reviewError}</div>}

              <form onSubmit={handleReviewSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                      Decision Status
                    </label>
                    <select
                      className="input"
                      value={reviewDecision}
                      onChange={(e) => {
                        setReviewDecision(e.target.value);
                        if (e.target.value === 'REJECTED') {
                          setOverrideAmount(0);
                        } else {
                          const adj = claimData.adjudication || claimData.decision;
                          const ext = claimData.extracted || claimData.extractedData;
                          setOverrideAmount(adj?.approvedAmount || adj?.approved_amount || ext?.bill_amount || 0);
                        }
                      }}
                      disabled={submittingReview}
                      style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    >
                      <option value="APPROVED">Approve Claim</option>
                      <option value="PARTIAL">Partially Approve Claim</option>
                      <option value="REJECTED">Reject Claim</option>
                    </select>
                  </div>

                  {['APPROVED', 'PARTIAL'].includes(reviewDecision) && (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                        Approved Amount (₹)
                      </label>
                      <input
                        type="number"
                        className="input"
                        value={overrideAmount}
                        onChange={(e) => setOverrideAmount(e.target.value)}
                        disabled={submittingReview}
                        min="0"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                        required
                      />
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                    Reviewer Notes / Rationale
                  </label>
                  <textarea
                    className="input"
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    placeholder="Enter clinical or administrative justification for this override..."
                    disabled={submittingReview}
                    rows="3"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical' }}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingReview}
                  style={{ backgroundColor: '#2563eb', border: 'none', padding: '10px 20px', color: 'white', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {submittingReview ? 'Submitting Override...' : 'Submit Final Adjudication'}
                </button>
              </form>
            </div>
          )}

          {/* Detailed Decision Process / Rules Checklist */}
          {validationSteps.length > 0 && (
            <div className="card" style={{ marginTop: 20, padding: '20px' }}>
              <div className="section-title" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⚙️ Adjudication Rules Processing Trace
              </div>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
                The claims engine evaluated the following logical checklist steps:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {validationSteps.map((step, idx) => {
                  const isPass = step.status === 'PASS';
                  const isFail = step.status === 'FAIL';
                  const isWarning = step.status === 'WARNING';
                  
                  let bgColor = '#f0fdf4';
                  let borderColor = '#bcf0da';
                  let textColor = '#15803d';
                  let iconComponent = (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '900',
                      lineHeight: 1,
                      flexShrink: 0
                    }}>
                      ✓
                    </div>
                  );

                  if (isFail) {
                    bgColor = '#fef2f2';
                    borderColor = '#fde2e2';
                    textColor = '#b91c1c';
                    iconComponent = (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#dc2626',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: '900',
                        lineHeight: 1,
                        flexShrink: 0
                      }}>
                        ✗
                      </div>
                    );
                  } else if (isWarning) {
                    bgColor = '#fffbeb';
                    borderColor = '#fef3c7';
                    textColor = '#d97706';
                    iconComponent = (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: '#ea580c',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: '900',
                        lineHeight: 1,
                        flexShrink: 0
                      }}>
                        !
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'flex-start', 
                        gap: 12, 
                        padding: '12px', 
                        backgroundColor: bgColor, 
                        border: `1px solid ${borderColor}`, 
                        borderRadius: '6px' 
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', marginTop: 2 }}>{iconComponent}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, color: textColor, fontSize: 13 }}>
                          {step.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
                          {step.details}
                        </div>
                      </div>
                      <span style={{ 
                        fontSize: 10, 
                        fontWeight: 'bold', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        backgroundColor: isPass ? '#d1fae5' : (isFail ? '#fee2e2' : '#fef3c7'),
                        color: textColor
                      }}>
                        {step.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Extracted data */}
          {extracted && (
            <div className="card">
              <div className="section-title" style={{ marginBottom: 12 }}>Extracted Data</div>
              <div className="data-grid">
                <Field label="Patient Name"    value={extracted.patient_name} />
                <Field label="Doctor"          value={extracted.doctor_name} />
                <Field label="Doctor Reg No"   value={extracted.doctor_reg} />
                <Field label="Hospital"        value={extracted.hospital_name} />
                <Field label="Diagnosis"       value={extracted.diagnosis} />
                <Field label="Treatment Date"  value={extracted.treatment_date} />
                <Field label="Submission Date" value={extracted.submission_date} />
                <Field label="Member Since"    value={extracted.member_join_date} />
                <Field label="Bill Amount"     value={extracted.bill_amount ? `₹${extracted.bill_amount.toLocaleString('en-IN')}` : null} />
                <Field label="Consultation"    value={extracted.consultation_fee ? `₹${extracted.consultation_fee.toLocaleString('en-IN')}` : null} />
                <Field label="Policy Active"   value={extracted.policy_active ? 'Yes' : 'No'} />
                <Field label="Member Covered"  value={extracted.member_covered ? 'Yes' : 'No'} />
                <Field label="Pre-Auth"        value={extracted.pre_auth ? 'Yes' : 'No'} />
                <Field label="Docs Legible"    value={extracted.documents_legible ? 'Yes' : 'No'} />
                <Field label="Same-day Claims" value={extracted.previous_claims_same_day ? String(extracted.previous_claims_same_day) : '0'} />
              </div>

              {extracted.medicines?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Medicines</div>
                  <ul style={{ paddingLeft: 18, fontSize: 13, color: '#333', lineHeight: 1.8 }}>
                    {extracted.medicines.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}

              {extracted.test_names?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#888', textTransform: 'uppercase', marginBottom: 4 }}>Tests</div>
                  <ul style={{ paddingLeft: 18, fontSize: 13, color: '#333', lineHeight: 1.8 }}>
                    {extracted.test_names.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Evaluation Metrics Quick Link */}
          <div className="card no-print" style={{ marginTop: 20, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>📈 Decision Engine Evaluation Matrix</div>
                <p style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
                  Our rules engine has a 100% precision score verified against automated ground-truth claims scenarios.
                </p>
              </div>
              <Link to="/metrics">
                <button className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  View Evaluation Matrix →
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* Sticky Document Preview Panel on the Right */}
        <aside style={{ position: 'sticky', top: '24px' }}>
          {claimData.documents && claimData.documents.length > 0 ? (
            <div className="card no-print" style={{ padding: '16px' }}>
              <div className="section-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Eye size={16} />
                Uploaded Files ({claimData.documents.length})
              </div>
              
              {claimData.documents.length > 1 && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
                  {claimData.documents.map((doc, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setActiveDocIdx(idx);
                      }}
                      className={`btn ${activeDocIdx === idx ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '4px 8px', fontSize: 11, whiteSpace: 'nowrap' }}
                    >
                      Doc {idx + 1}
                    </button>
                  ))}
                </div>
              )}

              {(() => {
                const activeDoc = claimData.documents[activeDocIdx];
                if (!activeDoc) return <p style={{ fontSize: 12, color: '#888' }}>No active file</p>;

                const isImage = /\.(jpg|jpeg|png|webp)$/i.test(activeDoc.storedName || activeDoc.originalName || '') || 
                                (activeDoc.mimetype && activeDoc.mimetype.startsWith('image/'));
                const fileUrl = `${API_BASE}/uploads/${activeDoc.storedName}`;

                return (
                  <div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={activeDoc.originalName}>
                      <strong>Name:</strong> {activeDoc.originalName}
                    </div>
                    
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      backgroundColor: '#f8fafc',
                      minHeight: '220px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      padding: '4px',
                      marginBottom: 10
                    }}>
                      {isImage ? (
                        <img 
                          src={fileUrl} 
                          alt={activeDoc.originalName} 
                          style={{ maxWidth: '100%', maxHeight: '380px', objectFit: 'contain', borderRadius: '4px' }} 
                        />
                      ) : (
                        <div style={{ textAlign: 'center', padding: '16px' }}>
                          <FileText size={32} style={{ color: '#94a3b8', marginBottom: 8 }} />
                          <p style={{ fontSize: 12, color: '#334155', fontWeight: 'bold' }}>PDF Document</p>
                          <a 
                            href={fileUrl} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="btn btn-secondary" 
                            style={{ marginTop: 8, display: 'inline-flex', fontSize: 10, padding: '4px 8px' }}
                          >
                            <ExternalLink size={10} />
                            Open PDF
                          </a>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <a 
                        href={fileUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="btn btn-secondary" 
                        style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '6px' }}
                      >
                        <ExternalLink size={12} />
                        View Full Size
                      </a>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="card no-print">
              <div className="section-title">No Uploaded Files</div>
              <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>No documents are attached to this claim.</p>
            </div>
          )}
        </aside>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }} className="no-print">
        <Link to="/upload"><button className="btn btn-primary" id="submit-another-btn">Submit Another Claim</button></Link>
        <Link to="/"><button className="btn btn-secondary">Dashboard</button></Link>
      </div>
    </div>
  );
}

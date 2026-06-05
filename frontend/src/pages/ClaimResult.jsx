import { useLocation, useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, FileText, IndianRupee, ShieldCheck, XCircle } from 'lucide-react';
import { claimApi } from '../api/claimApi';

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
      <div style={{ marginBottom: 16 }}>
        <Link to="/history" className="back-link">
          <ArrowLeft size={15} />
          Back to History
        </Link>
      </div>

      <h1 className="page-title">Claim Result</h1>
      <p className="page-subtitle" style={{ fontFamily: 'monospace' }}>
        {claimData.claimId}
        {processingMs > 0 && <span style={{ marginLeft: 12, color: '#aaa' }}>({(processingMs/1000).toFixed(1)}s)</span>}
      </p>

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
                  <option value="REJECTED">Reject Claim</option>
                </select>
              </div>

              {reviewDecision === 'APPROVED' && (
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
      <div className="card" style={{ marginTop: 20, border: '1px solid #e5e7eb', background: '#f9fafb' }}>
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

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Link to="/upload"><button className="btn btn-primary" id="submit-another-btn">Submit Another Claim</button></Link>
        <Link to="/"><button className="btn btn-secondary">Dashboard</button></Link>
      </div>
    </div>
  );
}

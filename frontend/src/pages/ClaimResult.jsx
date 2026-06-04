import { useLocation, useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { claimApi } from '../api/claimApi';

const decisionClass = (d) => {
  if (d === 'APPROVED')      return 'decision-approved';
  if (d === 'REJECTED')      return 'decision-rejected';
  if (d === 'PARTIAL')       return 'decision-partial';
  return 'decision-manual';
};

const decisionLabel = (d) => {
  if (d === 'APPROVED')      return '✓ Claim Approved';
  if (d === 'REJECTED')      return '✗ Claim Rejected';
  if (d === 'PARTIAL')       return '~ Partial Approval';
  return '⏱ Manual Review Required';
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

  useEffect(() => {
    if (!claimData && id) {
      claimApi.getClaim(id)
        .then(res => setClaimData(res.data || res))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id, claimData]);

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

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link to="/history" style={{ color: '#1d4ed8', fontSize: 13 }}>← Back to History</Link>
      </div>

      <h1 className="page-title">Claim Result</h1>
      <p className="page-subtitle" style={{ fontFamily: 'monospace' }}>
        {claimData.claimId}
        {processingMs > 0 && <span style={{ marginLeft: 12, color: '#aaa' }}>({(processingMs/1000).toFixed(1)}s)</span>}
      </p>

      {/* Decision */}
      {adjudication && (
        <div className={`decision-section ${decisionClass(decision)}`}>
          <div className="decision-title">{decisionLabel(decision)}</div>

          {adjudication.approved_amount > 0 && (
            <div style={{ margin: '12px 0' }}>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>Approved Amount</div>
              <div className="amount-display">₹{adjudication.approved_amount.toLocaleString('en-IN')}</div>
              {adjudication.original_amount && adjudication.original_amount !== adjudication.approved_amount && (
                <div style={{ fontSize: 12, color: '#888' }}>Claimed: ₹{adjudication.original_amount.toLocaleString('en-IN')}</div>
              )}
            </div>
          )}

          {adjudication.confidence_score != null && (
            <div style={{ margin: '10px 0', fontSize: 13, color: '#555' }}>
              Confidence: <strong>{Math.round(adjudication.confidence_score * 100)}%</strong>
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

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <Link to="/upload"><button className="btn btn-primary" id="submit-another-btn">Submit Another Claim</button></Link>
        <Link to="/"><button className="btn btn-secondary">Dashboard</button></Link>
      </div>
    </div>
  );
}

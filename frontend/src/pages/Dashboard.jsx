import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { claimApi, API_BASE } from '../api/claimApi';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState(null);

  useEffect(() => {
    claimApi.health()
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));

    claimApi.getClaims(1, 20)
      .then(res => setClaims(res.data || []))
      .catch(() => setClaims([]))
      .finally(() => setLoading(false));
  }, []);

  const stats = {
    total:    claims.length,
    approved: claims.filter(c => c.decision?.decision === 'APPROVED').length,
    rejected: claims.filter(c => c.decision?.decision === 'REJECTED').length,
    pending:  claims.filter(c => ['pending','processing','PARTIAL','MANUAL_REVIEW'].includes(c.decision?.decision || c.status)).length,
    totalApproved: claims
      .filter(c => c.decision?.approved_amount > 0)
      .reduce((s, c) => s + (c.decision?.approved_amount || 0), 0),
  };

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">OPD Claims Adjudication</p>

      {backendOnline === false && (
        <div className="alert alert-error">
          ⚠ Backend offline — start the server at {API_BASE}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Claims</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>{stats.approved}</div>
          {stats.totalApproved > 0 && (
            <div style={{ fontSize: 12, color: '#888' }}>₹{stats.totalApproved.toLocaleString('en-IN')}</div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Rejected</div>
          <div className="stat-value" style={{ color: '#dc2626' }}>{stats.rejected}</div>
        </div>
      </div>

      {/* Recent claims */}
      <div className="card">
        <div className="section-header">
          <span className="section-title">Recent Claims</span>
          <Link to="/history" className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }}>
            View all
          </Link>
        </div>

        {loading ? (
          <p style={{ color: '#888', padding: '20px 0' }}>Loading...</p>
        ) : claims.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
            <p>No claims yet.</p>
            <Link to="/upload">
              <button className="btn btn-primary" style={{ marginTop: 12 }} id="dashboard-first-claim-btn">
                Submit First Claim
              </button>
            </Link>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {claims.slice(0, 8).map(claim => (
                <tr key={claim._id || claim.claimId}>
                  <td>
                    <Link to={`/claims/${claim.claimId}`} style={{ color: '#1d4ed8', fontFamily: 'monospace' }}>
                      {claim.claimId}
                    </Link>
                  </td>
                  <td>{claim.patientName || '—'}</td>
                  <td>{claim.diagnosis || '—'}</td>
                  <td>{claim.billAmount > 0 ? `₹${claim.billAmount.toLocaleString('en-IN')}` : '—'}</td>
                  <td>
                    <StatusBadge status={claim.decision?.decision || claim.status || 'pending'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Link to="/upload">
        <button className="btn btn-primary" id="dashboard-upload-btn">+ Submit New Claim</button>
      </Link>
    </div>
  );
}

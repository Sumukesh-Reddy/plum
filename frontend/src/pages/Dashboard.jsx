import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FilePlus2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
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
    manual: claims.filter(c => c.decision?.decision === 'MANUAL_REVIEW').length,
    pending:  claims.filter(c => ['pending','processing','PARTIAL','MANUAL_REVIEW'].includes(c.decision?.decision || c.status)).length,
    totalApproved: claims
      .filter(c => (c.decision?.approvedAmount || c.decision?.approved_amount) > 0)
      .reduce((s, c) => s + (c.decision?.approvedAmount || c.decision?.approved_amount || 0), 0),
  };
  const approvalRate = stats.total ? Math.round((stats.approved / stats.total) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">OPD claim operations, extraction quality, and adjudication outcomes</p>
        </div>
        <Link to="/upload">
          <button className="btn btn-primary" id="dashboard-upload-btn">
            <FilePlus2 size={16} />
            Submit Claim
          </button>
        </Link>
      </div>

      {backendOnline === false && (
        <div className="alert alert-error">
          <AlertTriangle size={16} />
          Backend offline. Start the server at {API_BASE}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card stat-card-blue">
          <div className="stat-topline">
            <div className="stat-label">Total Claims</div>
            <FilePlus2 size={18} />
          </div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-hint">{loading ? 'Syncing claims' : 'Claims in current view'}</div>
        </div>
        <div className="stat-card stat-card-green">
          <div className="stat-topline">
            <div className="stat-label">Approved</div>
            <CheckCircle2 size={18} />
          </div>
          <div className="stat-value">{stats.approved}</div>
          {stats.totalApproved > 0 && (
            <div className="stat-hint">₹{stats.totalApproved.toLocaleString('en-IN')} approved payout</div>
          )}
        </div>
        <div className="stat-card stat-card-red">
          <div className="stat-topline">
            <div className="stat-label">Rejected</div>
            <XCircle size={18} />
          </div>
          <div className="stat-value">{stats.rejected}</div>
          <div className="stat-hint">Hard rule failures</div>
        </div>
        <div className="stat-card stat-card-amber">
          <div className="stat-topline">
            <div className="stat-label">Manual Review</div>
            <Clock3 size={18} />
          </div>
          <div className="stat-value">{stats.manual}</div>
          <div className="stat-hint">Needs human decision</div>
        </div>
      </div>

      <div className="insight-grid">
        <div className="insight-panel">
          <div className="section-title">Decision Health</div>
          <div className="progress-row">
            <span>Approval rate</span>
            <strong>{approvalRate}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${approvalRate}%` }} />
          </div>
          <p>Use this as a quick read on whether test claims are landing in the expected decision bands.</p>
        </div>
        <div className="insight-panel">
          <div className="section-title">Recommended Demo Flow</div>
          <div className="mini-steps">
            <span>Upload documents</span>
            <ArrowRight size={14} />
            <span>Review extraction</span>
            <ArrowRight size={14} />
            <span>Show trace</span>
          </div>
          <p>Manual review cases demonstrate the human-in-loop workflow best.</p>
        </div>
      </div>

      {/* Recent claims */}
      <div className="card">
        <div className="section-header">
          <span className="section-title">Recent Claims</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => window.location.reload()} title="Refresh dashboard">
              <RefreshCw size={15} />
            </button>
            <Link to="/history" className="btn btn-secondary">
              View all
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#888', padding: '20px 0' }}>Loading...</p>
        ) : claims.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#888' }}>
            <p>No claims yet.</p>
            <Link to="/upload">
              <button className="btn btn-primary" style={{ marginTop: 12 }} id="dashboard-first-claim-btn">
                <FilePlus2 size={16} />
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
                <th>Confidence</th>
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
                  <td>
                    {claim.decision?.confidenceScore != null
                      ? `${Math.round(claim.decision.confidenceScore * 100)}%`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

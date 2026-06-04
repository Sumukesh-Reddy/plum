import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { claimApi } from '../api/claimApi';
import StatusBadge from '../components/StatusBadge';

const ITEMS_PER_PAGE = 10;

export default function ClaimHistory() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [deleting, setDeleting] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError] = useState(null);

  const fetchClaims = useCallback(async (pageNum = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await claimApi.getClaims(pageNum, ITEMS_PER_PAGE);
      setClaims(res.data || []);
      setPagination(res.pagination || {});
    } catch (err) {
      setError(err.message);
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClaims(page); }, [page, fetchClaims]);

  const handleDelete = async (claimId) => {
    if (deleteConfirm !== claimId) { setDeleteConfirm(claimId); return; }
    setDeleting(claimId);
    try {
      await claimApi.deleteClaim(claimId);
      setClaims(prev => prev.filter(c => c.claimId !== claimId));
    } catch (err) {
      setError(`Failed to delete: ${err.message}`);
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  };

  const filtered = claims.filter(c =>
    !search ||
    c.claimId?.toLowerCase().includes(search.toLowerCase()) ||
    c.patientName?.toLowerCase().includes(search.toLowerCase()) ||
    c.diagnosis?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = pagination.pages || 1;

  return (
    <div>
      <div className="section-header">
        <div>
          <h1 className="page-title">Claim History</h1>
          <p className="page-subtitle">
            {pagination.total > 0 ? `${pagination.total} total claims` : 'All submitted claims'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => fetchClaims(page)} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <Link to="/upload">
            <button className="btn btn-primary" id="history-new-claim-btn">+ New Claim</button>
          </Link>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Search */}
      <input
        type="text"
        className="input"
        placeholder="Search by claim ID, patient name, or diagnosis..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        id="history-search"
        style={{ marginBottom: 12 }}
      />

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <p style={{ padding: 24, color: '#888' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#888' }}>
            <p>{search ? 'No claims match your search.' : 'No claims yet.'}</p>
            {!search && (
              <Link to="/upload">
                <button className="btn btn-primary" style={{ marginTop: 12 }}>Submit Claim</button>
              </Link>
            )}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Claim ID</th>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(claim => {
                const decision = claim.decision?.decision;
                const approved = claim.decision?.approved_amount;
                return (
                  <tr key={claim._id || claim.claimId}>
                    <td>
                      <Link to={`/claims/${claim.claimId}`} style={{ color: '#1d4ed8', fontFamily: 'monospace', fontSize: 12 }}>
                        {claim.claimId}
                      </Link>
                    </td>
                    <td>{claim.patientName || '—'}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {claim.diagnosis || '—'}
                    </td>
                    <td>
                      {claim.createdAt
                        ? new Date(claim.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td>
                      {approved > 0
                        ? <span style={{ color: '#16a34a', fontWeight: 600 }}>₹{approved.toLocaleString('en-IN')}</span>
                        : claim.billAmount > 0
                        ? `₹${claim.billAmount.toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td>
                      <StatusBadge status={decision || claim.status || 'pending'} />
                    </td>
                    <td>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '3px 10px', fontSize: 12 }}
                        onClick={() => handleDelete(claim.claimId)}
                        disabled={deleting === claim.claimId}
                      >
                        {deleteConfirm === claim.claimId ? 'Confirm?' : deleting === claim.claimId ? '...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <span style={{ fontSize: 13, color: '#888' }}>Page {page} of {totalPages}</span>
          <button className="btn btn-secondary" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1 || loading}>‹</button>
          <button className="btn btn-secondary" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages || loading}>›</button>
        </div>
      )}
    </div>
  );
}

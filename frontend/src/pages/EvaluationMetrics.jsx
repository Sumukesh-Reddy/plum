import { useState, useEffect } from 'react';
import { claimApi } from '../api/claimApi';

export default function EvaluationMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = () => {
    setRefreshing(true);
    claimApi.getEvaluationMetrics()
      .then(res => {
        if (res.success && res.data) {
          setMetrics(res.data);
        } else {
          setError('Failed to load performance metrics.');
        }
      })
      .catch(err => setError(err.message || 'An error occurred while loading metrics.'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '40px 0', color: '#888' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
        <p style={{ textAlign: 'center' }}>Running rules engine evaluation suite...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px' }}>
        <div className="alert alert-error">{error}</div>
        <button onClick={fetchMetrics} className="btn btn-primary" style={{ marginTop: 12 }}>Retry</button>
      </div>
    );
  }

  const { summary, classMetrics, results } = metrics;

  // Calculate Macro F1-Score
  const classNames = Object.keys(classMetrics);
  const macroF1 = classNames.length > 0
    ? classNames.reduce((acc, c) => acc + (classMetrics[c]?.f1Score || 0), 0) / classNames.length
    : 0;

  return (
    <div>
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">AI Rules Engine Evaluation</h1>
          <p className="page-subtitle">Adjudication performance against predefined ground-truth test cases</p>
        </div>
        <button 
          onClick={fetchMetrics} 
          className="btn btn-secondary" 
          disabled={refreshing}
          style={{ fontSize: 13, padding: '6px 16px' }}
        >
          {refreshing ? 'Re-evaluating...' : 'Run Test Suite'}
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ borderTop: '4px solid #2563eb' }}>
          <div className="stat-label">Decision Accuracy</div>
          <div className="stat-value" style={{ color: '#2563eb' }}>
            {Math.round(summary.accuracy * 100)}%
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            {summary.passedCases} of {summary.totalCases} cases passed
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #10b981' }}>
          <div className="stat-label">Macro-Average F1-Score</div>
          <div className="stat-value" style={{ color: '#10b981' }}>
            {Math.round(macroF1 * 100)}%
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            Across {classNames.length} decision classes
          </div>
        </div>

        <div className="stat-card" style={{ borderTop: '4px solid #f59e0b' }}>
          <div className="stat-label">Payout MAE</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>
            ₹{summary.mae.toFixed(0)}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            Mean Absolute Error on approved amount
          </div>
        </div>
      </div>

      {/* Class Level Performance Table */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>Performance by Decision Type</div>
        <table className="table">
          <thead>
            <tr>
              <th>Adjudication Class</th>
              <th style={{ textAlign: 'right' }}>Precision</th>
              <th style={{ textAlign: 'right' }}>Recall</th>
              <th style={{ textAlign: 'right' }}>F1-Score</th>
              <th style={{ textAlign: 'right' }}>Test Cases (Support)</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(classMetrics).map(cls => (
              <tr key={cls}>
                <td>
                  <strong>{cls.replace(/_/g, ' ')}</strong>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                  {Math.round(classMetrics[cls].precision * 100)}%
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                  {Math.round(classMetrics[cls].recall * 100)}%
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#111827' }}>
                  {Math.round(classMetrics[cls].f1Score * 100)}%
                </td>
                <td style={{ textAlign: 'right', color: '#666' }}>
                  {classMetrics[cls].support}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Individual Test Cases Table */}
      <div className="card">
        <div className="section-title" style={{ marginBottom: 12 }}>Test Case Adjudication Trace</div>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Test Scenario</th>
              <th>Expected</th>
              <th>Actual</th>
              <th style={{ textAlign: 'right' }}>Exp. Payout</th>
              <th style={{ textAlign: 'right' }}>Act. Payout</th>
              <th style={{ textAlign: 'center' }}>Result</th>
            </tr>
          </thead>
          <tbody>
            {results.map(res => (
              <tr key={res.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#4b5563' }}>{res.id}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{res.name}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{res.description}</div>
                </td>
                <td>
                  <span className={`badge badge-pending`} style={{ fontSize: 10, padding: '2px 6px' }}>
                    {res.expectedDecision}
                  </span>
                </td>
                <td>
                  <span 
                    className={`badge ${
                      res.actualDecision === 'APPROVED' ? 'badge-approved' :
                      res.actualDecision === 'REJECTED' ? 'badge-rejected' :
                      res.actualDecision === 'PARTIAL' ? 'badge-partial' : 'badge-manual'
                    }`} 
                    style={{ fontSize: 10, padding: '2px 6px' }}
                  >
                    {res.actualDecision}
                  </span>
                </td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>₹{res.expectedAmount.toLocaleString('en-IN')}</td>
                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>₹{res.actualAmount.toLocaleString('en-IN')}</td>
                <td style={{ textAlign: 'center' }}>
                  <span style={{ 
                    color: res.passed ? '#15803d' : '#b91c1c', 
                    fontWeight: 'bold',
                    fontSize: 13,
                    backgroundColor: res.passed ? '#f0fdf4' : '#fef2f2',
                    padding: '4px 8px',
                    borderRadius: '4px'
                  }}>
                    {res.passed ? 'PASS ✅' : 'FAIL ❌'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

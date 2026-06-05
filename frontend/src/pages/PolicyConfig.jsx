import { useState, useEffect } from 'react';
import { claimApi } from '../api/claimApi';

export default function PolicyConfig() {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Form Fields
  const [policyName, setPolicyName] = useState('');
  const [perClaimLimit, setPerClaimLimit] = useState(0);
  const [annualLimit, setAnnualLimit] = useState(0);
  const [copayPercentage, setCopayPercentage] = useState(0);
  const [networkDiscount, setNetworkDiscount] = useState(0);
  const [networkHospitals, setNetworkHospitals] = useState('');
  const [exclusions, setExclusions] = useState('');
  const [initialWaiting, setInitialWaiting] = useState(0);

  useEffect(() => {
    claimApi.getPolicy()
      .then(res => {
        if (res.success && res.data) {
          const data = res.data;
          setPolicy(data);
          setPolicyName(data.policy_name || '');
          setPerClaimLimit(data.coverage_details?.per_claim_limit || 0);
          setAnnualLimit(data.coverage_details?.annual_limit || 0);
          setCopayPercentage(data.coverage_details?.consultation_fees?.copay_percentage || 0);
          setNetworkDiscount(data.coverage_details?.consultation_fees?.network_discount || 0);
          setInitialWaiting(data.waiting_periods?.initial_waiting || 0);
          
          if (Array.isArray(data.network_hospitals)) {
            setNetworkHospitals(data.network_hospitals.join('\n'));
          }
          if (Array.isArray(data.exclusions)) {
            setExclusions(data.exclusions.join('\n'));
          }
        }
      })
      .catch(err => setError(err.message || 'Failed to load policy config.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    // Reconstruct the nested policy object
    const updatedPolicy = {
      ...policy,
      policy_name: policyName,
      coverage_details: {
        ...policy.coverage_details,
        per_claim_limit: Number(perClaimLimit),
        annual_limit: Number(annualLimit),
        consultation_fees: {
          ...policy.coverage_details?.consultation_fees,
          copay_percentage: Number(copayPercentage),
          network_discount: Number(networkDiscount)
        }
      },
      waiting_periods: {
        ...policy.waiting_periods,
        initial_waiting: Number(initialWaiting)
      },
      network_hospitals: networkHospitals.split('\n').map(h => h.trim()).filter(Boolean),
      exclusions: exclusions.split('\n').map(ex => ex.trim()).filter(Boolean)
    };

    try {
      const res = await claimApi.updatePolicy(updatedPolicy);
      if (res.success) {
        setMessage('Policy terms updated successfully!');
        setPolicy(res.data);
      } else {
        setError('Failed to update policy terms.');
      }
    } catch (err) {
      setError(err.message || 'An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 0', color: '#888' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }}></div>
        <p style={{ textAlign: 'center' }}>Loading policy configuration...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 className="page-title">Policy Configuration</h1>
      <p className="page-subtitle">Configure claims adjudication thresholds and rules</p>

      {message && <div className="alert alert-success" style={{ marginBottom: 16 }}>{message}</div>}
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <form onSubmit={handleSubmit} className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Policy Scheme Name
            </label>
            <input
              type="text"
              className="input"
              value={policyName}
              onChange={(e) => setPolicyName(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              required
            />
          </div>
        </div>

        <div className="section-title" style={{ fontSize: 14, color: '#4b5563', borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 16 }}>
          Coverage Limits & Waiting Periods
        </div>

        <div className="form-grid">
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Per-Claim Limit (₹)
            </label>
            <input
              type="number"
              className="input"
              value={perClaimLimit}
              onChange={(e) => setPerClaimLimit(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              min="0"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Annual Limit (₹)
            </label>
            <input
              type="number"
              className="input"
              value={annualLimit}
              onChange={(e) => setAnnualLimit(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              min="0"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Consultation Copay (%)
            </label>
            <input
              type="number"
              className="input"
              value={copayPercentage}
              onChange={(e) => setCopayPercentage(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              min="0"
              max="100"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Network Discount (%)
            </label>
            <input
              type="number"
              className="input"
              value={networkDiscount}
              onChange={(e) => setNetworkDiscount(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              min="0"
              max="100"
              required
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Initial Waiting Period (Days)
            </label>
            <input
              type="number"
              className="input"
              value={initialWaiting}
              onChange={(e) => setInitialWaiting(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              min="0"
              required
            />
          </div>
        </div>

        <div className="section-title" style={{ fontSize: 14, color: '#4b5563', borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 16 }}>
          Rule Arrays (One per line)
        </div>

        <div className="form-grid">
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Network Hospitals
            </label>
            <textarea
              className="input"
              value={networkHospitals}
              onChange={(e) => setNetworkHospitals(e.target.value)}
              placeholder="e.g. Apollo Hospitals"
              rows="6"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical', fontFamily: 'sans-serif', fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
              Excluded Treatments/Conditions
            </label>
            <textarea
              className="input"
              value={exclusions}
              onChange={(e) => setExclusions(e.target.value)}
              placeholder="e.g. Cosmetic procedures"
              rows="6"
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', resize: 'vertical', fontFamily: 'sans-serif', fontSize: 13 }}
            />
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving}
          style={{ width: '100%', padding: '12px', fontSize: 15 }}
        >
          {saving ? 'Saving Policy Configuration...' : 'Save Policy Changes'}
        </button>
      </form>
    </div>
  );
}

export default function StatusBadge({ status }) {
  const s = (status || '').toUpperCase();

  let cls = 'badge-pending';
  if (s === 'APPROVED')                     cls = 'badge-approved';
  else if (s === 'REJECTED')                cls = 'badge-rejected';
  else if (s === 'PARTIAL')                 cls = 'badge-partial';
  else if (s === 'MANUAL_REVIEW')           cls = 'badge-manual';
  else if (s === 'COMPLETED')               cls = 'badge-approved';
  else if (s === 'FAILED')                  cls = 'badge-rejected';

  const label = s === 'MANUAL_REVIEW' ? 'REVIEW' : s || 'PENDING';

  return <span className={`badge ${cls}`}>{label}</span>;
}

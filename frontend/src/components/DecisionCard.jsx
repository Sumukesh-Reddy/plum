import { motion } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Clock, IndianRupee } from 'lucide-react';
import ConfidenceBar from './ConfidenceBar';

const decisionConfig = {
  APPROVED: {
    icon: CheckCircle,
    title: 'Claim Approved',
    bg: 'from-emerald-500/20 to-teal-500/10',
    border: 'border-emerald-500/30',
    iconColor: 'text-emerald-400',
    glow: 'glow-green',
    badge: 'bg-emerald-500 text-white'
  },
  REJECTED: {
    icon: XCircle,
    title: 'Claim Rejected',
    bg: 'from-red-500/20 to-rose-500/10',
    border: 'border-red-500/30',
    iconColor: 'text-red-400',
    glow: 'glow-red',
    badge: 'bg-red-500 text-white'
  },
  PARTIAL: {
    icon: AlertTriangle,
    title: 'Partial Approval',
    bg: 'from-orange-500/20 to-amber-500/10',
    border: 'border-orange-500/30',
    iconColor: 'text-orange-400',
    glow: 'glow-orange',
    badge: 'bg-orange-500 text-white'
  },
  MANUAL_REVIEW: {
    icon: Clock,
    title: 'Manual Review Required',
    bg: 'from-yellow-500/20 to-amber-500/10',
    border: 'border-yellow-500/30',
    iconColor: 'text-yellow-400',
    glow: '',
    badge: 'bg-yellow-500 text-black'
  }
};

export default function DecisionCard({ adjudication }) {
  if (!adjudication) return null;
  const config = decisionConfig[adjudication.decision] || decisionConfig.MANUAL_REVIEW;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={`glass-card p-6 bg-gradient-to-br ${config.bg} border ${config.border} ${config.glow}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/10">
            <Icon size={28} className={config.iconColor} />
          </div>
          <div>
            <p className="text-sm text-gray-400 font-medium">Decision</p>
            <h2 className="text-2xl font-bold text-white">{config.title}</h2>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.badge}`}>
          {adjudication.decision}
        </span>
      </div>

      {/* Amount */}
      {adjudication.approved_amount > 0 && (
        <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/5">
          <p className="text-sm text-gray-400 mb-1">Approved Amount</p>
          <div className="flex items-center gap-1">
            <IndianRupee size={24} className="text-emerald-400" />
            <span className="text-3xl font-bold text-emerald-400">
              {adjudication.approved_amount.toLocaleString('en-IN')}
            </span>
          </div>
          {adjudication.original_amount && adjudication.original_amount !== adjudication.approved_amount && (
            <p className="text-xs text-gray-500 mt-1">
              Original: ₹{adjudication.original_amount.toLocaleString('en-IN')}
            </p>
          )}
        </div>
      )}

      {/* Confidence */}
      <div className="mb-6">
        <ConfidenceBar score={adjudication.confidence_score || 0} />
      </div>

      {/* Rejection Reasons */}
      {adjudication.rejection_reasons?.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-400 font-medium mb-2 flex items-center gap-2">
            <XCircle size={14} className="text-red-400" />
            Rejection Reasons
          </p>
          <div className="flex flex-wrap gap-2">
            {adjudication.rejection_reasons.map((reason, i) => (
              <span key={i} className="px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-medium">
                {reason.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {adjudication.notes?.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-400 font-medium mb-2">Notes</p>
          <ul className="space-y-1">
            {adjudication.notes.map((note, i) => (
              <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Steps */}
      {adjudication.next_steps && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-xs text-gray-500 font-medium">Next Steps</p>
          <p className="text-sm text-gray-300 mt-1">{adjudication.next_steps}</p>
        </div>
      )}
    </motion.div>
  );
}

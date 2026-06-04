import { motion } from 'framer-motion';

const getColor = (score) => {
  if (score >= 0.8) return 'from-emerald-500 to-teal-400';
  if (score >= 0.6) return 'from-yellow-500 to-amber-400';
  return 'from-red-500 to-rose-400';
};

export default function ConfidenceBar({ score = 0, animated = true }) {
  const percentage = Math.round(score * 100);
  const color = getColor(score);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400 font-medium">Confidence Score</span>
        <span className="text-sm font-bold text-white">{percentage}%</span>
      </div>
      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={animated ? { width: 0 } : { width: `${percentage}%` }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          className={`h-full rounded-full bg-gradient-to-r ${color} shadow-lg`}
        />
      </div>
    </div>
  );
}

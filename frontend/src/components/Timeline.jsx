import { motion } from 'framer-motion';
import { Upload, ScanLine, Brain, Gavel, CheckCircle } from 'lucide-react';

const steps = [
  { id: 'upload', icon: Upload, label: 'Uploaded', color: 'blue' },
  { id: 'ocr', icon: ScanLine, label: 'OCR', color: 'purple' },
  { id: 'ai', icon: Brain, label: 'AI Analysis', color: 'indigo' },
  { id: 'adjudication', icon: Gavel, label: 'Rule Engine', color: 'cyan' },
  { id: 'decision', icon: CheckCircle, label: 'Decision', color: 'emerald' },
];

const colorMap = {
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', icon: 'text-blue-400' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/40', icon: 'text-purple-400' },
  indigo: { bg: 'bg-indigo-500/20', border: 'border-indigo-500/40', icon: 'text-indigo-400' },
  cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', icon: 'text-cyan-400' },
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', icon: 'text-emerald-400' },
};

export default function Timeline({ activeStep = 4 }) {
  return (
    <div className="glass-card p-6">
      <h3 className="section-title mb-6">Processing Timeline</h3>
      <div className="flex items-start justify-between relative">
        {/* Connecting line */}
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-white/5" />
        <motion.div
          className="absolute top-5 left-5 h-0.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${(activeStep / (steps.length - 1)) * (100 - 10)}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
        />

        {steps.map((step, index) => {
          const isComplete = index <= activeStep;
          const colors = colorMap[step.color];
          const Icon = step.icon;
          return (
            <div key={step.id} className="flex flex-col items-center gap-2 z-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.15 + 0.2 }}
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all
                  ${isComplete ? `${colors.bg} ${colors.border}` : 'bg-navy-900 border-white/10'}`}
              >
                <Icon size={16} className={isComplete ? colors.icon : 'text-gray-600'} />
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.15 + 0.4 }}
                className={`text-xs text-center font-medium w-16 ${isComplete ? 'text-white' : 'text-gray-600'}`}
              >
                {step.label}
              </motion.p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

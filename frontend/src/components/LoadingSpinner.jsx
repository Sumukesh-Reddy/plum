import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ScanLine, Cpu, CheckCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

const stages = [
  { icon: ScanLine, text: 'Running OCR on documents...', color: 'text-blue-400' },
  { icon: Brain, text: 'AI extracting medical data...', color: 'text-purple-400' },
  { icon: Cpu, text: 'Applying adjudication rules...', color: 'text-cyan-400' },
  { icon: CheckCircle, text: 'Finalizing decision...', color: 'text-emerald-400' },
];

export default function LoadingSpinner({ isVisible }) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setStageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStageIndex(prev => (prev + 1) % stages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isVisible]);

  const stage = stages[stageIndex];
  const Icon = stage.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-navy-900/90 backdrop-blur-sm flex items-center justify-center"
        >
          <div className="text-center px-8">
            {/* Animated rings */}
            <div className="relative w-32 h-32 mx-auto mb-8">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-blue-500/30"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
                  transition={{ duration: 2, delay: i * 0.6, repeat: Infinity }}
                />
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={stageIndex}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    transition={{ duration: 0.4 }}
                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30"
                  >
                    <Icon size={28} className="text-white" />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={stageIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-2xl font-bold text-white mb-2">Processing Claim</p>
                <p className={`text-base font-medium ${stage.color}`}>{stage.text}</p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex gap-2 justify-center">
              {stages.map((_, i) => (
                <motion.div
                  key={i}
                  animate={{
                    width: i === stageIndex ? 32 : 6,
                    backgroundColor: i <= stageIndex ? '#3B82F6' : 'rgba(255,255,255,0.15)'
                  }}
                  transition={{ duration: 0.3 }}
                  className="h-1.5 rounded-full"
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shield, Activity } from 'lucide-react';

export default function Navbar() {
  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 h-16 bg-navy-900/80 backdrop-blur-xl border-b border-white/5"
    >
      <div className="max-w-screen-xl mx-auto px-6 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Shield size={18} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-lg leading-none">Plum AI</span>
            <span className="block text-xs text-gray-500 leading-none">Claims Adjudication</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Activity size={12} className="text-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">AI Active</span>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

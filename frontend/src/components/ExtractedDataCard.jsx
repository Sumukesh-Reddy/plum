import { motion } from 'framer-motion';
import { User, Stethoscope, Building2, Calendar, IndianRupee, Pill, TestTube, Hash } from 'lucide-react';

const Field = ({ icon: Icon, label, value, delay = 0 }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="flex items-start gap-3 p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
        <Icon size={15} className="text-blue-400" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</p>
        <p className="text-sm text-white font-medium mt-0.5 break-words">{value}</p>
      </div>
    </motion.div>
  );
};

export default function ExtractedDataCard({ extracted }) {
  if (!extracted) return null;

  return (
    <div className="glass-card p-6">
      <h3 className="section-title mb-4 flex items-center gap-2">
        <span className="w-2 h-6 rounded-full bg-gradient-to-b from-blue-500 to-indigo-600" />
        Extracted Information
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field icon={User} label="Patient Name" value={extracted.patient_name} delay={0} />
        <Field icon={Stethoscope} label="Doctor" value={extracted.doctor_name} delay={0.05} />
        <Field icon={Hash} label="Doctor Reg" value={extracted.doctor_reg} delay={0.1} />
        <Field icon={Building2} label="Hospital" value={extracted.hospital_name} delay={0.15} />
        <Field icon={Stethoscope} label="Diagnosis" value={extracted.diagnosis} delay={0.2} />
        <Field icon={Calendar} label="Treatment Date" value={extracted.treatment_date} delay={0.25} />
        <Field
          icon={IndianRupee}
          label="Bill Amount"
          value={extracted.bill_amount != null ? `₹${Number(extracted.bill_amount).toLocaleString('en-IN')}` : null}
          delay={0.3}
        />
        <Field
          icon={IndianRupee}
          label="Consultation Fee"
          value={extracted.consultation_fee != null ? `₹${Number(extracted.consultation_fee).toLocaleString('en-IN')}` : null}
          delay={0.35}
        />
      </div>

      {extracted.medicines?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
            <Pill size={13} className="text-purple-400" /> Medicines
          </p>
          <div className="flex flex-wrap gap-2">
            {extracted.medicines.map((med, i) => (
              <span key={i} className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-lg text-xs text-purple-300">
                {med}
              </span>
            ))}
          </div>
        </div>
      )}

      {extracted.test_names?.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2 flex items-center gap-2">
            <TestTube size={13} className="text-cyan-400" /> Tests
          </p>
          <div className="flex flex-wrap gap-2">
            {extracted.test_names.map((test, i) => (
              <span key={i} className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-xs text-cyan-300">
                {test}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

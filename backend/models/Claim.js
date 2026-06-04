const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  claimId: {
    type: String,
    required: true,
    unique: true,
    default: () => `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  patientName: { type: String, default: 'Unknown' },
  doctorName: { type: String, default: '' },
  hospitalName: { type: String, default: '' },
  diagnosis: { type: String, default: '' },
  treatmentDate: { type: Date },
  billAmount: { type: Number, default: 0 },
  documents: [{
    originalName: String,
    storedName: String,
    mimetype: String,
    size: Number,
    path: String
  }],
  extractedData: { type: mongoose.Schema.Types.Mixed, default: {} },
  decision: {
    decision: { type: String, enum: ['APPROVED', 'REJECTED', 'PARTIAL', 'MANUAL_REVIEW'] },
    approvedAmount: { type: Number, default: 0 },
    rejectionReasons: [String],
    confidenceScore: { type: Number, default: 0 },
    notes: [String],
    nextSteps: String
  },
  processingTime: { type: Number }, // ms
  error: { type: String }
}, {
  timestamps: true
});

claimSchema.index({ status: 1 });
claimSchema.index({ createdAt: -1 });
claimSchema.index({ patientName: 'text', diagnosis: 'text' });

module.exports = mongoose.model('Claim', claimSchema);

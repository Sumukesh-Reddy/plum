const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  createClaim,
  getClaims,
  getClaimById,
  deleteClaim,
  overrideClaim,
  getPolicy,
  updatePolicy,
  evaluateAdjudicator
} = require('../controllers/claimController');

// POST /api/claims — Upload documents and process claim
router.post('/', upload.array('documents', 10), createClaim);

// GET /api/claims — List all claims
router.get('/', getClaims);

// GET /api/claims/evaluate — Retrieve accuracy and validation metrics
router.get('/evaluate', evaluateAdjudicator);

// GET /api/claims/policy — Retrieve current policy terms configuration
router.get('/policy', getPolicy);

// PUT /api/claims/policy — Update policy terms configuration
router.put('/policy', updatePolicy);

// GET /api/claims/:id — Get claim by ID
router.get('/:id', getClaimById);

// PUT /api/claims/:id/override — Override claim decision
router.put('/:id/override', overrideClaim);

// DELETE /api/claims/:id
router.delete('/:id', deleteClaim);

module.exports = router;

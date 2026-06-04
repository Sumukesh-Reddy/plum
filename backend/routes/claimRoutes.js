const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const {
  createClaim,
  getClaims,
  getClaimById,
  deleteClaim
} = require('../controllers/claimController');

// POST /api/claims — Upload documents and process claim
router.post('/', upload.array('documents', 10), createClaim);

// GET /api/claims — List all claims
router.get('/', getClaims);

// GET /api/claims/:id — Get claim by ID
router.get('/:id', getClaimById);

// DELETE /api/claims/:id
router.delete('/:id', deleteClaim);

module.exports = router;

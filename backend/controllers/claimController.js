const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Claim = require('../models/Claim');
const AuditLog = require('../models/AuditLog');
const { extractText, cleanText } = require('../services/ocrService');
const { extractStructuredData, extractFromImageDirect } = require('../services/openaiService');
const { processAdjudication } = require('../services/adjudicationService');

// POST /api/claims — Upload and process a new claim
exports.createClaim = async (req, res, next) => {
  const startTime = Date.now();
  let claim = null;

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    // Generate a unique claim ID
    const claimId = `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Build document list
    const documents = req.files.map(f => ({
      originalName: f.originalname,
      storedName: f.filename,
      mimetype: f.mimetype,
      size: f.size,
      path: f.path
    }));

    // Create initial claim record
    claim = new Claim({
      claimId,
      status: 'processing',
      documents
    });

    // Save to DB if connected
    try { await claim.save(); } catch (dbErr) {
      console.warn('DB save skipped (no MongoDB):', dbErr.message);
    }

    // Process each uploaded file
    let combinedText = '';
    let extractedData = null;
    let firstFileError = null;

    for (const file of req.files) {
      try {
        console.log(`Processing file: ${file.originalname} (${file.mimetype}, ${file.size} bytes) at ${file.path}`);
        if (file.mimetype === 'application/pdf') {
          const text = await extractText(file.path, file.mimetype);
          combinedText += '\n' + cleanText(text);
        } else {
          // For images: use Gemini Vision for every document. Bills/reports often
          // lose critical fields such as totals when downgraded to OCR text.
          const visionData = await extractFromImageDirect(file.path, file.mimetype);
          extractedData = extractedData
            ? mergeExtractedData(extractedData, visionData)
            : visionData;
          console.log('Merged vision extraction:', JSON.stringify(extractedData, null, 2));
        }
      } catch (fileErr) {
        console.error(`❌ Error processing file ${file.originalname}:`, fileErr.message);
        if (!firstFileError) firstFileError = fileErr;
      }
    }

    // If we have combined text from PDF/additional OCR, supplement extraction
    if (!extractedData && combinedText.trim()) {
      extractedData = await extractStructuredData(combinedText);
    } else if (combinedText.trim() && extractedData) {
      // Try to fill in missing fields from OCR text
      const supplemental = await extractStructuredData(combinedText);
      extractedData = mergeExtractedData(extractedData, supplemental);
    }

    if (!extractedData) {
      // Surface the real underlying error so it's debuggable
      const realReason = firstFileError ? firstFileError.message : 'Unknown — check server logs';
      throw new Error(`Could not extract any data from the uploaded documents. Underlying cause: ${realReason}`);
    }

    // Check for duplicate claim in DB (similar patient, date and bill amount)
    let isDuplicate = false;
    let duplicateClaimId = null;
    try {
      if (extractedData.patient_name && extractedData.treatment_date) {
        const existingClaim = await Claim.findOne({
          patientName: extractedData.patient_name,
          treatmentDate: new Date(extractedData.treatment_date),
          billAmount: extractedData.bill_amount || 0,
          status: 'completed',
          claimId: { $ne: claimId }
        });
        
        if (existingClaim) {
          isDuplicate = true;
          duplicateClaimId = existingClaim.claimId;
          console.log(`⚠️ Duplicate claim detected: matches ${duplicateClaimId}`);
        }
      }
    } catch (dbErr) {
      console.warn('Duplicate check skipped/failed (e.g. no DB connection):', dbErr.message);
    }

    // Run adjudication
    const adjudicationResult = processAdjudication(extractedData, claimId);

    // If duplicate, append warnings and force manual review
    if (isDuplicate) {
      extractedData.is_duplicate = true;
      extractedData.duplicate_claim_id = duplicateClaimId;
      
      adjudicationResult.decision = 'MANUAL_REVIEW';
      adjudicationResult.rejection_reasons.push('POTENTIAL_DUPLICATE');
      adjudicationResult.notes.unshift(`⚠️ WARNING: A claim with identical patient name, treatment date, and amount already exists (Claim ID: ${duplicateClaimId})`);
      adjudicationResult.next_steps = 'Referred to manual review to verify potential duplicate submission';
    }

    const processingTime = Date.now() - startTime;

    // Update claim with results
    const updatedClaim = {
      status: 'completed',
      patientName: extractedData.patient_name || 'Unknown',
      doctorName: extractedData.doctor_name || '',
      hospitalName: extractedData.hospital_name || '',
      diagnosis: extractedData.diagnosis || '',
      treatmentDate: extractedData.treatment_date ? new Date(extractedData.treatment_date) : null,
      billAmount: extractedData.bill_amount || 0,
      extractedData,
      decision: {
        decision: adjudicationResult.decision,
        approvedAmount: adjudicationResult.approved_amount,
        rejectionReasons: adjudicationResult.rejection_reasons,
        confidenceScore: adjudicationResult.confidence_score,
        notes: adjudicationResult.notes,
        nextSteps: adjudicationResult.next_steps,
        validationSteps: adjudicationResult.validation_steps || []
      },
      processingTime
    };

    if (claim._id) {
      try {
        await Claim.findByIdAndUpdate(claim._id, updatedClaim);
        await AuditLog.create({
          claimId,
          action: 'CLAIM_PROCESSED',
          details: { decision: adjudicationResult.decision, processingTime }
        });
      } catch (dbErr) {
        console.warn('DB update skipped:', dbErr.message);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        claimId,
        status: 'completed',
        processingTime,
        documents,
        extracted: extractedData,
        adjudication: {
          decision: adjudicationResult.decision,
          approved_amount: adjudicationResult.approved_amount,
          rejection_reasons: adjudicationResult.rejection_reasons,
          confidence_score: adjudicationResult.confidence_score,
          notes: adjudicationResult.notes,
          next_steps: adjudicationResult.next_steps,
          validation_steps: adjudicationResult.validation_steps || []
        }
      }
    });

  } catch (error) {
    console.error('Claim processing error:', error);

    if (claim && claim._id) {
      try {
        await Claim.findByIdAndUpdate(claim._id, {
          status: 'failed',
          error: error.message
        });
      } catch (dbErr) { /* ignore */ }
    }

    next(error);
  }
};

// GET /api/claims — List all claims
exports.getClaims = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let claims, total;
    try {
      claims = await Claim.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-extractedData');
      total = await Claim.countDocuments();
    } catch (dbErr) {
      console.warn('DB read skipped:', dbErr.message);
      claims = [];
      total = 0;
    }

    res.json({
      success: true,
      data: claims,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/claims/:id — Get single claim
exports.getClaimById = async (req, res, next) => {
  try {
    let claim;
    try {
      claim = await Claim.findOne({ claimId: req.params.id });
    } catch (dbErr) {
      console.warn('DB read skipped:', dbErr.message);
    }

    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    res.json({ success: true, data: claim });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/claims/:id
exports.deleteClaim = async (req, res, next) => {
  try {
    let claim;
    try {
      claim = await Claim.findOneAndDelete({ claimId: req.params.id });
    } catch (dbErr) {
      console.warn('DB delete skipped:', dbErr.message);
    }

    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    res.json({ success: true, message: 'Claim deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// PUT /api/claims/:id/override — Override claim decision (Appeals / Manual Review)
exports.overrideClaim = async (req, res, next) => {
  try {
    const { decision, approvedAmount, notes } = req.body;
    
    if (!decision) {
      return res.status(400).json({ success: false, error: 'Decision status is required' });
    }

    let claim;
    try {
      claim = await Claim.findOne({ claimId: req.params.id });
    } catch (dbErr) {
      console.warn('DB read skipped:', dbErr.message);
    }

    if (!claim) {
      return res.status(404).json({ success: false, error: 'Claim not found' });
    }

    // Merge notes if provided
    const newNotes = Array.isArray(notes) 
      ? notes 
      : (notes ? [notes] : []);
    const mergedNotes = [...(claim.decision?.notes || []), ...newNotes];

    const updatedDecision = {
      decision,
      approvedAmount: Number(approvedAmount) || 0,
      rejectionReasons: ['APPROVED', 'PARTIAL'].includes(decision) ? [] : (claim.decision?.rejectionReasons || []),
      confidenceScore: 1.0, // Manual override has 100% confidence
      notes: mergedNotes,
      nextSteps: ['APPROVED', 'PARTIAL'].includes(decision) ? 'Payout processed' : 'Claim rejected by manual reviewer'
    };

    // Update in DB
    try {
      claim = await Claim.findOneAndUpdate(
        { claimId: req.params.id },
        { decision: updatedDecision },
        { new: true }
      );
      
      await AuditLog.create({
        claimId: req.params.id,
        action: 'CLAIM_OVERRIDDEN',
        details: { decision, approvedAmount }
      });
    } catch (dbErr) {
      console.warn('DB update skipped:', dbErr.message);
      // Fallback for non-DB mode
      claim.decision = updatedDecision;
    }

    res.json({
      success: true,
      message: 'Claim decision overridden successfully',
      data: claim
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/claims/policy — Retrieve current policy terms configuration
exports.getPolicy = async (req, res, next) => {
  try {
    const policyPath = path.join(__dirname, '..', 'policy_terms.json');
    const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    res.json({ success: true, data: policy });
  } catch (error) {
    next(error);
  }
};

// PUT /api/claims/policy — Update policy terms configuration
exports.updatePolicy = async (req, res, next) => {
  try {
    const policyPath = path.join(__dirname, '..', 'policy_terms.json');
    const newPolicy = req.body;

    if (!newPolicy || typeof newPolicy !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid policy payload' });
    }

    fs.writeFileSync(policyPath, JSON.stringify(newPolicy, null, 2), 'utf8');
    
    res.json({ success: true, message: 'Policy terms updated successfully', data: newPolicy });
  } catch (error) {
    next(error);
  }
};

// GET /api/claims/evaluate — Run test suite and return rules engine accuracy metrics
exports.evaluateAdjudicator = async (req, res, next) => {
  try {
    const testCasesPath = path.join(__dirname, '..', 'test_cases.json');
    const { test_cases: testCases } = JSON.parse(fs.readFileSync(testCasesPath, 'utf8'));
    
    const adjudicate = require('../adjudicator');
    
    let correctDecisions = 0;
    let totalAmountError = 0;
    
    const classes = ['APPROVED', 'REJECTED', 'PARTIAL', 'MANUAL_REVIEW'];
    const stats = {};
    classes.forEach(c => {
      stats[c] = { tp: 0, fp: 0, fn: 0, tn: 0 };
    });
    
    const individualResults = [];
    
    testCases.forEach((tc) => {
      const prescription = tc.input_data.documents?.prescription || {};
      const bill = tc.input_data.documents?.bill || {};
      
      const mappedData = {
        claim_id: tc.case_id || 'TC_TEST',
        total_amount: tc.input_data.claim_amount || 0,
        diagnosis: prescription.diagnosis || '',
        doctor_reg: prescription.doctor_reg || '',
        doctor_name: prescription.doctor_name || '',
        hospital: tc.input_data.hospital || '',
        documents: {
          prescription: !!tc.input_data.documents?.prescription,
          bill: !!tc.input_data.documents?.bill
        },
        treatment_date: tc.input_data.treatment_date || '2024-11-01',
        submission_date: tc.input_data.treatment_date || '2024-11-01',
        member_join_date: tc.input_data.member_join_date || '2024-01-01',
        policy_active: tc.input_data.policy_active !== false,
        member_covered: tc.input_data.member_covered !== false,
        documents_legible: tc.input_data.documents_legible !== false,
        pre_auth: tc.input_data.pre_auth !== false,
        consultation_fee: bill.consultation_fee || 0,
        bill: bill,
        procedures: prescription.procedures || [],
        previous_claims_amount: tc.input_data.previous_claims_amount || 0,
        previous_claims_same_day: tc.input_data.previous_claims_same_day || 0
      };
      
      const result = adjudicate(mappedData);
      
      const expected = tc.expected_output.decision;
      const actual = result.decision;
      const expectedAmt = tc.expected_output.approved_amount || 0;
      const actualAmt = result.approved_amount || 0;
      
      const decisionMatch = expected === actual;
      if (decisionMatch) correctDecisions++;
      
      totalAmountError += Math.abs(expectedAmt - actualAmt);
      
      classes.forEach(c => {
        if (expected === c && actual === c) stats[c].tp++;
        else if (expected !== c && actual === c) stats[c].fp++;
        else if (expected === c && actual !== c) stats[c].fn++;
        else stats[c].tn++;
      });
      
      individualResults.push({
        id: tc.case_id,
        name: tc.case_name,
        description: tc.description,
        expectedDecision: expected,
        actualDecision: actual,
        expectedAmount: expectedAmt,
        actualAmount: actualAmt,
        passed: decisionMatch
      });
    });
    
    const accuracy = correctDecisions / testCases.length;
    const mae = totalAmountError / testCases.length;
    
    const classMetrics = {};
    classes.forEach(c => {
      const { tp, fp, fn } = stats[c];
      const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
      const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
      const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
      classMetrics[c] = {
        precision,
        recall,
        f1Score: f1,
        support: tp + fn
      };
    });
    
    res.json({
      success: true,
      data: {
        summary: {
          totalCases: testCases.length,
          passedCases: correctDecisions,
          accuracy,
          mae
        },
        classMetrics,
        results: individualResults
      }
    });
  } catch (error) {
    next(error);
  }
};

const isMissingValue = (value) => {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'number' && value === 0) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
};

const mergeUniqueArray = (a = [], b = []) => {
  const values = [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
  return [...new Set(values.filter(Boolean))];
};

// Helper: merge multiple document extractions into one claim-level record.
const mergeExtractedData = (primary, secondary) => {
  const merged = { ...primary };

  for (const key of Object.keys(secondary)) {
    if (key === 'medicines' || key === 'test_names') {
      merged[key] = mergeUniqueArray(merged[key], secondary[key]);
    } else if (key === 'bill_amount' || key === 'consultation_fee') {
      const primaryIsBill = primary.document_type === 'bill';
      const secondaryIsBill = secondary.document_type === 'bill';
      const primaryVal = Number(primary[key]) || 0;
      const secondaryVal = Number(secondary[key]) || 0;

      if (primaryIsBill && !secondaryIsBill) {
        merged[key] = primaryVal;
      } else if (!primaryIsBill && secondaryIsBill) {
        merged[key] = secondaryVal;
      } else {
        merged[key] = Math.max(primaryVal, secondaryVal);
      }
    } else if (key === 'documents_legible') {
      merged[key] = merged[key] !== false || secondary[key] !== false;
    } else if (key === 'documents') {
      merged[key] = {
        ...(merged[key] || {}),
        ...(secondary[key] || {})
      };
    } else if (isMissingValue(merged[key]) && !isMissingValue(secondary[key])) {
      merged[key] = secondary[key];
    }
  }

  // Preserve best document type classification
  if (primary.document_type === 'bill' || secondary.document_type === 'bill') {
    merged.document_type = 'bill';
  } else if (primary.document_type === 'prescription' || secondary.document_type === 'prescription') {
    merged.document_type = 'prescription';
  }

  return merged;
};

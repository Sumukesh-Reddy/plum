const path = require('path');
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
          // For images: use GPT-4o Vision directly (more accurate than Tesseract)
          if (!extractedData) {
            extractedData = await extractFromImageDirect(file.path, file.mimetype);
            console.log('Vision extraction succeeded:', JSON.stringify(extractedData, null, 2));
          } else {
            // Fallback OCR for additional images
            const text = await extractText(file.path, file.mimetype);
            combinedText += '\n' + cleanText(text);
          }
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

    // Run adjudication
    const adjudicationResult = processAdjudication(extractedData, claimId);

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
        nextSteps: adjudicationResult.next_steps
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
        extracted: extractedData,
        adjudication: {
          decision: adjudicationResult.decision,
          approved_amount: adjudicationResult.approved_amount,
          rejection_reasons: adjudicationResult.rejection_reasons,
          confidence_score: adjudicationResult.confidence_score,
          notes: adjudicationResult.notes,
          next_steps: adjudicationResult.next_steps
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

// Helper: merge two extraction results, preferring non-null values
const mergeExtractedData = (primary, secondary) => {
  const merged = { ...primary };
  for (const key of Object.keys(secondary)) {
    if ((merged[key] === null || merged[key] === '' || merged[key] === 0) && secondary[key]) {
      merged[key] = secondary[key];
    }
  }
  return merged;
};

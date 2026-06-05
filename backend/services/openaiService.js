const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
console.log(`Using Gemini model: ${GEMINI_MODEL}`);

const EXTRACTION_PROMPT = `You are a medical insurance claims extraction specialist.
Analyze the provided medical document and extract structured data.

Return ONLY a valid JSON object with these exact fields (no markdown, no code fences):
{
  "document_type": "prescription | bill | report | other",
  "patient_name": "string or null",
  "doctor_name": "string or null",
  "doctor_reg": "registration number like MH/12345/2020 or null",
  "hospital_name": "string or null",
  "diagnosis": "medical diagnosis or condition or null",
  "medicines": ["medicine name with dosage"],
  "test_names": ["diagnostic test names"],
  "bill_amount": number or null,
  "consultation_fee": number or null,
  "treatment_date": "YYYY-MM-DD or null",
  "submission_date": "YYYY-MM-DD or null",
  "member_join_date": "YYYY-MM-DD or null",
  "policy_active": true or false,
  "member_covered": true or false,
  "documents_legible": true or false,
  "pre_auth": true or false,
  "previous_claims_same_day": number or null,
  "claim_id": "string or null"
}

If a field cannot be determined, use null.
For boolean fields with no evidence, assume true (benefit of the doubt).
If the document mentions "Previous Claims Same Day", "same-day claims", or similar fraud/frequency markers, extract that count into previous_claims_same_day.
For money fields, ignore currency symbols such as ₹, Rs, INR, and commas.
Important: never read the rupee symbol (₹) as the digit 2. For example, "₹1,061" means 1061, not 21061.
When a bill has Sub Total, CGST, SGST, and Net Amount, use the printed Net Amount/Total as bill_amount and cross-check it equals the components.

Few-shot examples for extraction:

--- Example 1 (Prescription Document) ---
Text / Image Content:
"Apollo Clinics. Dr. Anand K, MBBS. Reg No: TN/48293/2012. Patient: Ramesh Kumar. Date: 12-Nov-2024. Diagnosis: Hypertension. Rx: Amlodipine 5mg once daily."
Extracted JSON:
{
  "document_type": "prescription",
  "patient_name": "Ramesh Kumar",
  "doctor_name": "Dr. Anand K",
  "doctor_reg": "TN/48293/2012",
  "hospital_name": "Apollo Clinics",
  "diagnosis": "Hypertension",
  "medicines": ["Amlodipine 5mg once daily"],
  "test_names": [],
  "bill_amount": null,
  "consultation_fee": null,
  "treatment_date": "2024-11-12",
  "submission_date": "2024-11-12",
  "member_join_date": null,
  "policy_active": true,
  "member_covered": true,
  "documents_legible": true,
  "pre_auth": false,
  "previous_claims_same_day": null,
  "claim_id": null
}

--- Example 2 (Pharmacy Receipt / Bill Document) ---
Text / Image Content:
"Care Pharmacy, 21 Anna Salai, Chennai. Receipt #9342. Date: 15/10/2024. Patient: Ramesh Kumar. 1. Amlodipine 5mg - Qty 30: ₹961.00. 2. Consultation fee: ₹100.00. Total Net Amount Paid: ₹1,061.00."
Extracted JSON:
{
  "document_type": "bill",
  "patient_name": "Ramesh Kumar",
  "doctor_name": null,
  "doctor_reg": null,
  "hospital_name": "Care Pharmacy",
  "diagnosis": null,
  "medicines": ["Amlodipine 5mg"],
  "test_names": [],
  "bill_amount": 1061,
  "consultation_fee": 100,
  "treatment_date": "2024-10-15",
  "submission_date": "2024-10-15",
  "member_join_date": null,
  "policy_active": true,
  "member_covered": true,
  "documents_legible": true,
  "pre_auth": false,
  "previous_claims_same_day": null,
  "claim_id": "9342"
}

Return ONLY the raw JSON object — no markdown, no explanation, no code blocks.`;

const logGeminiExtraction = (source, raw, parsed, normalized) => {
  console.log(`\n========== GEMINI ${source.toUpperCase()} RAW OUTPUT ==========`);
  console.log(raw);
  console.log(`========== GEMINI ${source.toUpperCase()} PARSED JSON ==========`);
  console.log(JSON.stringify(parsed, null, 2));
  console.log(`========== GEMINI ${source.toUpperCase()} NORMALIZED DATA ==========`);
  console.log(JSON.stringify(normalized, null, 2));
  console.log(`========== END GEMINI ${source.toUpperCase()} OUTPUT ==========\n`);
};

// Extract from OCR/PDF text via Gemini
const extractStructuredData = async (ocrText, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Gemini text extraction attempt ${attempt}/${retries}`);

      const result = await model.generateContent([
        EXTRACTION_PROMPT,
        `Extract data from this medical document text:\n\n${ocrText}`
      ]);

      const raw = result.response.text().trim();
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      const normalized = normalizeExtractedData(parsed);
      logGeminiExtraction('text', raw, parsed, normalized);
      return normalized;
    } catch (error) {
      console.error(`Gemini attempt ${attempt} failed:`, error.message);
      if (attempt === retries) {
        throw new Error(`Gemini extraction failed after ${retries} attempts: ${error.message}`);
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
};

// Extract directly from image via Gemini Vision
const extractFromImageDirect = async (filePath, mimeType, retries = 3) => {
  const fileData = fs.readFileSync(filePath);
  const base64 = fileData.toString('base64');
  const mediaType = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Gemini vision extraction attempt ${attempt}/${retries}`);

      const result = await model.generateContent([
        EXTRACTION_PROMPT,
        'Extract data from this medical document image:',
        {
          inlineData: {
            mimeType: mediaType,
            data: base64
          }
        }
      ]);

      const raw = result.response.text().trim();
      // Strip markdown code fences if Gemini wraps the JSON
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(cleaned);
      const normalized = normalizeExtractedData(parsed);
      logGeminiExtraction('vision', raw, parsed, normalized);
      return normalized;
    } catch (error) {
      console.error(`Gemini vision attempt ${attempt} failed:`, error.message);
      if (error.status) console.error(`  → HTTP ${error.status}:`, error.message);
      if (attempt === retries) throw new Error(`Vision extraction failed: ${error.message}`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
};

const normalizeMoneyAmount = (value, fieldName) => {
  const amount = typeof value === 'number' ? value : Number(String(value || '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(amount)) return 0;

  const rounded = Math.round(amount);
  const digits = String(rounded);

  if (digits.length === 5 && digits.startsWith('21')) {
    const withoutLeadingGlyph = Number(digits.slice(1));
    if (withoutLeadingGlyph >= 1000 && withoutLeadingGlyph < 2000) {
      console.warn(
        `[amount-normalizer] Corrected ${fieldName} from ${rounded} to ${withoutLeadingGlyph}. ` +
        'Likely rupee symbol misread as leading digit 2.'
      );
      return withoutLeadingGlyph;
    }
  }

  return amount;
};

const normalizeCount = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const count = typeof value === 'number' ? value : Number(String(value).replace(/[^\d]/g, ''));
  return Number.isFinite(count) ? count : 0;
};

const normalizeExtractedData = (data) => {
  return {
    document_type: data.document_type || 'other',
    patient_name: data.patient_name || null,
    doctor_name: data.doctor_name || null,
    doctor_reg: data.doctor_reg || '',
    hospital_name: data.hospital_name || null,
    diagnosis: data.diagnosis || '',
    medicines: Array.isArray(data.medicines) ? data.medicines : [],
    test_names: Array.isArray(data.test_names) ? data.test_names : [],
    bill_amount: normalizeMoneyAmount(data.bill_amount ?? data.total_amount, 'bill_amount'),
    consultation_fee: normalizeMoneyAmount(data.consultation_fee, 'consultation_fee'),
    treatment_date: data.treatment_date || new Date().toISOString().split('T')[0],
    submission_date: data.submission_date || new Date().toISOString().split('T')[0],
    member_join_date: data.member_join_date || null,
    policy_active: data.policy_active !== false,
    member_covered: data.member_covered !== false,
    documents_legible: data.documents_legible !== false,
    pre_auth: data.pre_auth === true,
    previous_claims_same_day: normalizeCount(data.previous_claims_same_day),
    claim_id: data.claim_id || null,
    documents: { prescription: true, bill: true }
  };
};

module.exports = { extractStructuredData, extractFromImageDirect };

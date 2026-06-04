const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const EXTRACTION_PROMPT = `You are a medical insurance claims extraction specialist.
Analyze the provided medical document and extract structured data.

Return ONLY a valid JSON object with these exact fields (no markdown, no code fences):
{
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
  "claim_id": "string or null"
}

If a field cannot be determined, use null.
For boolean fields with no evidence, assume true (benefit of the doubt).
Return ONLY the raw JSON object — no markdown, no explanation, no code blocks.`;

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
      return normalizeExtractedData(parsed);
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
      return normalizeExtractedData(parsed);
    } catch (error) {
      console.error(`Gemini vision attempt ${attempt} failed:`, error.message);
      if (error.status) console.error(`  → HTTP ${error.status}:`, error.message);
      if (attempt === retries) throw new Error(`Vision extraction failed: ${error.message}`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
};

const normalizeExtractedData = (data) => {
  return {
    patient_name: data.patient_name || null,
    doctor_name: data.doctor_name || null,
    doctor_reg: data.doctor_reg || '',
    hospital_name: data.hospital_name || null,
    diagnosis: data.diagnosis || '',
    medicines: Array.isArray(data.medicines) ? data.medicines : [],
    test_names: Array.isArray(data.test_names) ? data.test_names : [],
    bill_amount: typeof data.bill_amount === 'number' ? data.bill_amount : (data.total_amount || 0),
    consultation_fee: typeof data.consultation_fee === 'number' ? data.consultation_fee : 0,
    treatment_date: data.treatment_date || new Date().toISOString().split('T')[0],
    submission_date: data.submission_date || new Date().toISOString().split('T')[0],
    member_join_date: data.member_join_date || null,
    policy_active: data.policy_active !== false,
    member_covered: data.member_covered !== false,
    documents_legible: data.documents_legible !== false,
    pre_auth: data.pre_auth === true,
    claim_id: data.claim_id || null,
    documents: { prescription: true, bill: true }
  };
};

module.exports = { extractStructuredData, extractFromImageDirect };

# Plum OPD Claim Adjudication Tool

An AI-powered full-stack application for automating Outpatient Department (OPD) insurance claim adjudication. Users upload medical documents such as prescriptions, pharmacy bills, diagnostic reports, and invoices. The backend extracts structured claim data with Gemini/OCR, evaluates the claim against configurable policy terms, and returns an approval, rejection, partial approval, or manual review decision with reasoning.

This project was built for the Plum AI Automation Engineer intern assignment.

## Features

- Multi-document claim upload for PDF, JPG, JPEG, and PNG files
- Gemini Vision extraction for uploaded images
- PDF/text extraction fallback with OCR support
- Rule-based adjudication engine using policy limits and business rules
- Explainable claim decision with validation trace
- Confidence score and manual review routing
- Admin manual override flow for review cases
- Policy settings page for configurable insurance terms
- Claim history and detail pages
- Evaluation metrics dashboard for the provided test cases

## Tech Stack

Frontend:

- React 18
- Vite
- React Router
- Axios
- Tailwind/CSS

Backend:

- Node.js
- Express
- MongoDB with Mongoose
- Multer for uploads
- Gemini API via `@google/generative-ai`
- Tesseract.js and `pdf-parse` for OCR/PDF text extraction

## Project Structure

```text
plum/
  backend/
    index.js                       Main Express server
    adjudicator.js                 Claim adjudication rules engine
    policy_terms.json              Insurance policy configuration
    test_cases.json                Ground-truth evaluation cases
    controllers/claimController.js Upload, extraction, adjudication, history, policy, metrics
    services/openaiService.js      Gemini extraction and normalization
    services/ocrService.js         OCR/PDF extraction
    models/Claim.js                Claim persistence model
    models/AuditLog.js             Audit log model
    routes/claimRoutes.js          Claim API routes
    middleware/upload.js           File upload configuration
  frontend/
    src/
      pages/UploadClaim.jsx        Claim submission UI
      pages/ClaimResult.jsx        Decision result and manual review UI
      pages/ClaimHistory.jsx       Claim history
      pages/PolicyConfig.jsx       Policy settings page
      pages/EvaluationMetrics.jsx  Test metrics dashboard
      api/claimApi.js              Frontend API client
```

Note: `backend/server.js` is an older prototype. Use `backend/index.js`, which is wired to `npm start` and `npm run dev`.

## How It Works

1. User uploads medical documents in the frontend.
2. Backend stores upload metadata and processes each file.
3. Image documents are sent to Gemini Vision for structured extraction.
4. PDF documents are parsed/OCRed and then sent to Gemini for structured extraction.
5. Extracted fields from multiple documents are merged into one claim record.
6. The adjudicator validates the claim against policy terms.
7. The backend stores the result and returns the decision to the frontend.
8. The result page shows extracted data, payout, rejection reasons, notes, next steps, and the rules trace.

## Extracted Fields

Gemini is prompted to return structured JSON with fields such as:

- `patient_name`
- `doctor_name`
- `doctor_reg`
- `hospital_name`
- `diagnosis`
- `medicines`
- `test_names`
- `bill_amount`
- `consultation_fee`
- `treatment_date`
- `submission_date`
- `member_join_date`
- `policy_active`
- `member_covered`
- `documents_legible`
- `pre_auth`
- `previous_claims_same_day`

The backend also normalizes common extraction issues, including rupee-symbol amount errors such as reading `₹1,061` as `21061`.

## Adjudication Logic

The main decision engine is in:

```text
backend/adjudicator.js
```

It evaluates:

- Policy active status
- Member coverage
- Initial and condition-specific waiting periods
- Required documents
- Doctor registration format
- Document legibility
- Patient/date mismatches
- Excluded treatments
- Pre-authorization requirements
- Per-claim and annual policy limits
- Consultation sub-limits
- Co-pay and network discount
- Medical necessity
- Late submission
- Minimum claim amount
- Same-day fraud/frequency indicators
- High-value manual review threshold

Possible decisions:

- `APPROVED`
- `REJECTED`
- `PARTIAL`
- `MANUAL_REVIEW`

## Policy Settings Page

The Policy Settings page lets an admin view and update policy terms stored in:

```text
backend/policy_terms.json
```

This page is useful because insurance rules change over time. Instead of editing code for every policy update, admins can change values like:

- Annual claim limit
- Per-claim limit
- Consultation sub-limit
- Pharmacy, dental, vision, and alternative medicine limits
- Waiting periods
- Minimum claim amount
- Submission deadline
- Network hospitals
- Cashless settings
- Exclusions

The adjudicator reads this policy file while processing claims, so updated values affect future decisions.

## Setup

### 1. Clone or open the project

```bash
cd /Users/sumukesh/Documents/plum
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
MONGODB_URI=mongodb://localhost:27017/plum_claims
```

Notes:

- `GEMINI_API_KEY` is required for real document extraction.
- `GEMINI_MODEL` is optional. If omitted, the app defaults to `gemini-2.0-flash`.
- MongoDB is recommended for persistence, but the server will still run without it. Claim history and duplicate detection need MongoDB to work properly.

Start the backend:

```bash
npm run dev
```

Backend URL:

```text
http://localhost:3000
```

Health check:

```text
http://localhost:3000/health
```

### 3. Frontend setup

Open a second terminal:

```bash
cd /Users/sumukesh/Documents/plum/frontend
npm install
npm run dev
```

Frontend URL:

```text
http://localhost:5173
```

The Vite dev server proxies `/api` calls to `http://localhost:3000`.

If you deploy the frontend separately, set:

```env
VITE_API_URL=https://your-backend-url
```

## API Overview

Base URL:

```text
http://localhost:3000/api
```

Endpoints:

```text
POST   /claims              Upload documents and process a claim
GET    /claims              List claims
GET    /claims/:id          Get one claim
DELETE /claims/:id          Delete a claim
PUT    /claims/:id/override Manual review override
GET    /claims/policy       Get current policy settings
PUT    /claims/policy       Update policy settings
GET    /claims/evaluate     Run rule-engine evaluation
```

Upload field name:

```text
documents
```

Supported file types:

```text
PDF, JPG, JPEG, PNG
```

Maximum file size:

```text
10 MB per file
```

## Testing The Rules Engine

Run the provided adjudication test suite:

```bash
cd /Users/sumukesh/Documents/plum/backend
node scripts/evaluate.js
```

This runs against `backend/test_cases.json` and does not call Gemini, so it does not consume API quota.

The frontend also exposes these results on the AI Metrics page.

## Testing With Generated Documents

For realistic end-to-end testing:

1. Generate a prescription image and bill image for a case.
2. Upload both files together on the Submit Claim page.
3. Watch the backend console for Gemini raw, parsed, and normalized output.
4. Confirm extracted fields such as `bill_amount`, `doctor_reg`, `pre_auth`, and `previous_claims_same_day`.
5. Review the final decision and validation trace in the frontend.

Important quota note:

- Each uploaded image can use one Gemini Vision request.
- Uploading 2 images for 5 cases can consume around 10 requests.
- If you hit Gemini free-tier rate limits, wait for reset, enable billing, or test fewer images.

## Manual Review Flow

Claims are routed to manual review when:

- Same-day claim frequency looks suspicious
- Claim amount is high
- Fraud indicators are detected
- Confidence is low

On the result page, the Admin Manual Review Panel lets a reviewer:

- Approve the claim
- Reject the claim
- Set the final approved amount
- Add reviewer notes

This demonstrates a human-in-the-loop workflow instead of blindly rejecting suspicious cases.

## Environment Variables

Backend:

```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
MONGODB_URI=mongodb://localhost:27017/plum_claims
```

Frontend:

```env
VITE_API_URL=http://localhost:3000
```

## Known Limitations

- Real-world OCR and image extraction quality depends on document clarity, angle, lighting, and model quota.
- Some business rules are still implemented as keyword checks in `backend/adjudicator.js`.
- Policy values are configurable, but not every rule is fully externalized into `policy_terms.json`.
- MongoDB is needed for persistent history and reliable duplicate detection.
- The generated test documents are fictional and should be clearly watermarked as test documents.

## Future Improvements

- Move more rule conditions from code into configurable policy data
- Add a structured document type classifier before extraction
- Store itemized bill lines for more accurate partial approvals
- Add stronger duplicate detection across providers and dates
- Add authentication for admin policy updates and manual review
- Add CI tests for extraction normalization and adjudication edge cases
- Add deployment docs for Vercel/Railway/Render

## Demo Checklist

Recommended demo flow:

1. Open dashboard.
2. Upload an approved claim with prescription and bill.
3. Show extracted data and validation trace.
4. Upload a rejected claim, such as below minimum amount or policy inactive.
5. Upload a manual review claim with `Previous Claims Same Day: 3`.
6. Use the Admin Manual Review Panel to submit final adjudication.
7. Open Policy Settings and explain configurable terms.
8. Open AI Metrics and show rule-engine test accuracy.


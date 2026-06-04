const fs = require('fs');
const path = require('path');

function adjudicate(extractedData) {
    const policyPath = path.join(__dirname, 'policy_terms.json');
    const policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));

    let result = {
        claim_id: extractedData.claim_id || "CLM_UNKNOWN",
        decision: "APPROVED",
        approved_amount: extractedData.total_amount || 0,
        rejection_reasons: [],
        confidence_score: 1.0,
        notes: [],
        next_steps: "Claim processed successfully"
    };

    // ===============================
    // BASIC VARIABLES
    // ===============================
    const totalAmount = extractedData.total_amount || 0;
    const diagnosis = extractedData.diagnosis || "";
    const doctorReg = extractedData.doctor_reg || "";
    const documents = extractedData.documents || {};
    const treatmentDate = new Date(extractedData.treatment_date);
    const memberJoinDate = new Date(extractedData.member_join_date);
    const submissionDate = new Date(extractedData.submission_date);
    const billItems = extractedData.bill || {};

    // ===============================
    // STEP 1: BASIC ELIGIBILITY CHECK
    // ===============================
    if (!extractedData.policy_active) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("POLICY_INACTIVE");
    }

    if (!extractedData.member_covered) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("MEMBER_NOT_COVERED");
    }

    // ===============================
    // WAITING PERIOD CHECKS
    // ===============================
    const diffDays = (treatmentDate - memberJoinDate) / (1000 * 60 * 60 * 24);

    // Initial waiting period
    if (diffDays < policy.waiting_periods.initial_waiting) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("WAITING_PERIOD");
        result.notes.push(
            `Initial waiting period of ${policy.waiting_periods.initial_waiting} days not completed`
        );
    }

    // Diabetes waiting period
    if (
        diagnosis.toLowerCase().includes("diabetes") &&
        diffDays < policy.waiting_periods.specific_ailments.diabetes
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("WAITING_PERIOD");
        result.notes.push("Diabetes waiting period not completed");
    }

    // Hypertension waiting period
    if (
        diagnosis.toLowerCase().includes("hypertension") &&
        diffDays < policy.waiting_periods.specific_ailments.hypertension
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("WAITING_PERIOD");
        result.notes.push("Hypertension waiting period not completed");
    }

    // ===============================
    // STEP 2: DOCUMENT VALIDATION
    // ===============================
    if (!documents.prescription) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("MISSING_DOCUMENTS");
    }

    if (!documents.bill) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("MISSING_DOCUMENTS");
    }

    // Doctor registration validation (relaxed to support alternative medicine registrations)
    const doctorRegex = /^(?:[A-Z]{2}|AYUR|HOME|UNANI)\/(?:[A-Z]{2}\/)?\d+\/\d{4}$/;
    if (!doctorRegex.test(doctorReg)) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("DOCTOR_REG_INVALID");
    }

    if (extractedData.documents_legible === false) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("ILLEGIBLE_DOCUMENTS");
    }

    if (extractedData.date_mismatch === true) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("DATE_MISMATCH");
    }

    if (extractedData.patient_mismatch === true) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("PATIENT_MISMATCH");
    }

    // ===============================
    // STEP 3: COVERAGE VERIFICATION & EXCLUSIONS
    // ===============================
    if (
        diagnosis.toLowerCase().includes("cosmetic") ||
        diagnosis.toLowerCase().includes("whitening")
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("COSMETIC_PROCEDURE");
    }

    if (diagnosis.toLowerCase().includes("experimental")) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("EXPERIMENTAL_TREATMENT");
    }

    if (
        diagnosis.toLowerCase().includes("weight loss") ||
        diagnosis.toLowerCase().includes("obesity")
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("SERVICE_NOT_COVERED");
    }

    if (diagnosis.toLowerCase().includes("hiv")) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("EXCLUDED_CONDITION");
    }

    // Itemized deductions for cosmetic or excluded procedures in bill items
    let itemizedDeductions = 0;
    Object.keys(billItems).forEach(key => {
        if (key.toLowerCase().includes("whitening") || key.toLowerCase().includes("cosmetic")) {
            itemizedDeductions += billItems[key];
            result.rejection_reasons.push(`EXCLUDED_ITEM: ${key.replace(/_/g, ' ')}`);
        }
    });

    if (itemizedDeductions > 0 && result.decision !== "REJECTED") {
        result.decision = "PARTIAL";
        result.approved_amount -= itemizedDeductions;
        result.notes.push(`Cosmetic/excluded procedure cost of ₹${itemizedDeductions} deducted`);
    }

    // ===============================
    // MRI PRE-AUTH CHECK
    // ===============================
    if (
        diagnosis.toLowerCase().includes("mri") &&
        !extractedData.pre_auth
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("PRE_AUTH_MISSING");
    }

    // ===============================
    // STEP 4: LIMIT VALIDATION
    // ===============================
    // Specific sub-limit overrides for dental/alternative medicine
    const isDental = diagnosis.toLowerCase().includes("dental") || 
                     diagnosis.toLowerCase().includes("tooth") || 
                     diagnosis.toLowerCase().includes("teeth") ||
                     Object.keys(billItems).some(k => k.toLowerCase().includes("dental") || k.toLowerCase().includes("canal"));
                     
    const isAlternative = diagnosis.toLowerCase().includes("ayur") || 
                          diagnosis.toLowerCase().includes("panchakarma") || 
                          diagnosis.toLowerCase().includes("joint pain");

    const effectiveLimit = isDental 
      ? policy.coverage_details.dental.sub_limit 
      : (isAlternative ? policy.coverage_details.alternative_medicine.sub_limit : policy.coverage_details.per_claim_limit);

    if (result.approved_amount > effectiveLimit) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("PER_CLAIM_EXCEEDED");
        result.notes.push(
            `Claim exceeds effective limit of ₹${effectiveLimit}`
        );
    }

    // Annual limit
    const totalYearlyClaims =
        (extractedData.previous_claims_amount || 0) + totalAmount;

    if (
        totalYearlyClaims >
        policy.coverage_details.annual_limit
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("ANNUAL_LIMIT_EXCEEDED");
    }

    // Consultation sub limit (only if not already rejected)
    if (
        extractedData.consultation_fee >
        policy.coverage_details.consultation_fees.sub_limit
    ) {
        if (result.decision !== "REJECTED") {
            result.decision = "PARTIAL";
            result.approved_amount = policy.coverage_details.consultation_fees.sub_limit;
            result.notes.push("Consultation sub-limit applied");
        }
    }

    // ===============================
    // CO-PAY CALCULATION
    // ===============================
    const isNetwork = extractedData.hospital && policy.network_hospitals.includes(extractedData.hospital);

    if (
        extractedData.consultation_fee &&
        result.decision === "APPROVED" &&
        !isNetwork &&
        !extractedData.cashless_request
    ) {
        const copay =
            (totalAmount *
                policy.coverage_details.consultation_fees.copay_percentage) /
            100;

        result.approved_amount -= copay;
        result.notes.push(`Co-pay deducted: ₹${copay}`);
    }

    // ===============================
    // STEP 5: MEDICAL NECESSITY
    // ===============================
    if (
        diagnosis === "" ||
        diagnosis === null
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("NOT_MEDICALLY_NECESSARY");
    }

    // ===============================
    // STEP 6: LATE SUBMISSION
    // ===============================
    const submissionGap =
        (submissionDate - treatmentDate) /
        (1000 * 60 * 60 * 24);

    if (
        submissionGap >
        policy.claim_requirements.submission_timeline_days
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("LATE_SUBMISSION");
    }

    // ===============================
    // STEP 7: MINIMUM CLAIM AMOUNT
    // ===============================
    if (
        totalAmount <
        policy.claim_requirements.minimum_claim_amount
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("BELOW_MIN_AMOUNT");
    }

    // ===============================
    // STEP 8: FRAUD DETECTION
    // ===============================
    if (
        extractedData.previous_claims_same_day &&
        extractedData.previous_claims_same_day >= 3
    ) {
        result.decision = "MANUAL_REVIEW";
        result.notes.push(
            "Multiple claims detected on same day"
        );
    }

    // High value claims
    if (totalAmount > 25000) {
        result.decision = "MANUAL_REVIEW";
        result.notes.push(
            "High value claim requires manual review"
        );
    }

    // ===============================
    // NETWORK HOSPITAL DISCOUNT
    // ===============================
    if (isNetwork) {
        const discount =
            (totalAmount *
                policy.coverage_details.consultation_fees.network_discount) /
            100;

        result.approved_amount -= discount;
        result.notes.push(
            `Network hospital discount applied: ₹${discount}`
        );
    }

    // ===============================
    // DYNAMIC CONFIDENCE SCORE CALCULATION
    // ===============================
    let dynamicScore = 1.0;
    
    // 1. Legibility
    if (extractedData.documents_legible === false) {
        dynamicScore -= 0.50;
    }
    
    // 2. Missing Essential Fields
    if (!extractedData.patient_name) {
        dynamicScore -= 0.15;
    }
    if (!extractedData.doctor_name) {
        dynamicScore -= 0.10;
    }
    if (!extractedData.hospital_name && !extractedData.hospital) {
        dynamicScore -= 0.10;
    }
    if (!extractedData.doctor_reg) {
        dynamicScore -= 0.15;
    } else if (!doctorRegex.test(doctorReg)) {
        dynamicScore -= 0.10;
    }
    
    // 3. Document Completeness
    if (extractedData.documents) {
        if (!extractedData.documents.prescription) {
            dynamicScore -= 0.20;
        }
        if (!extractedData.documents.bill) {
            dynamicScore -= 0.20;
        }
    }
    
    // 4. Clinical Inconsistencies / Warnings
    if (extractedData.date_mismatch === true) {
        dynamicScore -= 0.15;
    }
    if (extractedData.patient_mismatch === true) {
        dynamicScore -= 0.20;
    }
    
    // 5. Fraud trigger deductions
    if (extractedData.previous_claims_same_day && extractedData.previous_claims_same_day >= 3) {
        dynamicScore -= 0.30;
    }
    if (totalAmount > 25000) {
        dynamicScore -= 0.15;
    }
    
    // Clamp score between 10% and 100%
    result.confidence_score = Math.max(0.10, Math.min(1.0, dynamicScore));

    // ===============================
    // FINAL RESOLUTIONS
    // ===============================
    result.rejection_reasons = [
        ...new Set(result.rejection_reasons)
    ];

    // If rejected or manual review, approved amount = 0
    if (result.decision === "REJECTED" || result.decision === "MANUAL_REVIEW") {
        result.approved_amount = 0;
    }

    // If no rejection reasons and no notes
    if (
        result.rejection_reasons.length === 0 &&
        result.notes.length === 0
    ) {
        result.notes.push("All validations passed");
    }

    return result;
}

module.exports = adjudicate;
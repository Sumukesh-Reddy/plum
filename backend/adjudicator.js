const policy = require("./policy_terms.json");

function adjudicate(extractedData) {
    let result = {
        claim_id: extractedData.claim_id || "CLM_UNKNOWN",
        decision: "APPROVED",
        approved_amount: extractedData.total_amount || 0,
        rejection_reasons: [],
        confidence_score: 0.95,
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

    // ===============================
    // STEP 1: BASIC ELIGIBILITY CHECK
    // ===============================

    // POLICY ACTIVE
    if (!extractedData.policy_active) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("POLICY_INACTIVE");
    }

    // MEMBER COVERED
    if (!extractedData.member_covered) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("MEMBER_NOT_COVERED");
    }

    // ===============================
    // WAITING PERIOD CHECKS
    // ===============================

    const diffDays =
        (treatmentDate - memberJoinDate) / (1000 * 60 * 60 * 24);

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

    // Missing prescription
    if (!documents.prescription) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("MISSING_DOCUMENTS");
    }

    // Missing bill
    if (!documents.bill) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("MISSING_DOCUMENTS");
    }

    // Doctor registration validation
    const doctorRegex = /^[A-Z]{2}\/\d+\/\d{4}$/;

    if (!doctorRegex.test(doctorReg)) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("DOCTOR_REG_INVALID");
    }

    // Illegible documents
    if (extractedData.documents_legible === false) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("ILLEGIBLE_DOCUMENTS");
    }

    // Date mismatch
    if (extractedData.date_mismatch === true) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("DATE_MISMATCH");
    }

    // Patient mismatch
    if (extractedData.patient_mismatch === true) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("PATIENT_MISMATCH");
    }

    // ===============================
    // STEP 3: COVERAGE VERIFICATION
    // ===============================

    const exclusions = policy.exclusions.map((e) => e.toLowerCase());

    // Cosmetic procedures
    if (
        diagnosis.toLowerCase().includes("cosmetic") ||
        diagnosis.toLowerCase().includes("whitening")
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("COSMETIC_PROCEDURE");
    }

    // Experimental treatment
    if (diagnosis.toLowerCase().includes("experimental")) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("EXPERIMENTAL_TREATMENT");
    }

    // Weight loss excluded
    if (
        diagnosis.toLowerCase().includes("weight loss") ||
        diagnosis.toLowerCase().includes("obesity")
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("SERVICE_NOT_COVERED");
    }

    // HIV exclusion
    if (diagnosis.toLowerCase().includes("hiv")) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("EXCLUDED_CONDITION");
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

    // Per claim limit
    if (
        totalAmount >
        policy.coverage_details.per_claim_limit
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("PER_CLAIM_EXCEEDED");

        result.notes.push(
            `Claim exceeds per claim limit of ₹${policy.coverage_details.per_claim_limit}`
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

    // Consultation sub limit
    if (
        extractedData.consultation_fee >
        policy.coverage_details.consultation_fees.sub_limit
    ) {
        result.decision = "PARTIAL";

        result.approved_amount =
            policy.coverage_details.consultation_fees.sub_limit;

        result.notes.push("Consultation sub-limit applied");
    }

    // ===============================
    // CO-PAY CALCULATION
    // ===============================

    if (
        extractedData.consultation_fee &&
        result.decision === "APPROVED"
    ) {
        const copay =
            (extractedData.consultation_fee *
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

        result.confidence_score = 0.65;
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

    if (
        extractedData.hospital &&
        policy.network_hospitals.includes(
            extractedData.hospital
        )
    ) {
        const discount =
            (totalAmount *
                policy.coverage_details.consultation_fees.network_discount) /
            100;

        result.approved_amount -= discount;

        result.notes.push(
            `Network hospital discount applied: ₹${discount}`
        );
    }

    result.rejection_reasons = [
        ...new Set(result.rejection_reasons)
    ];

    // If rejected, approved amount = 0
    if (result.decision === "REJECTED") {
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
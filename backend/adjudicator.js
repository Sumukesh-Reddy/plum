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
        next_steps: "Claim processed successfully",
        validation_steps: []
    };

    const validationSteps = [];
    const addStep = (name, status, details) => {
        validationSteps.push({ name, status, details });
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
        addStep("Policy Active Status", "FAIL", "Insurance policy scheme is inactive/expired");
    } else {
        addStep("Policy Active Status", "PASS", "Insurance policy scheme is currently active");
    }

    if (!extractedData.member_covered) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("MEMBER_NOT_COVERED");
        addStep("Member Coverage Status", "FAIL", "Member profile is not covered under this employer group plan");
    } else {
        addStep("Member Coverage Status", "PASS", "Member profile is eligible and covered under this plan");
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
        addStep("Initial Waiting Period Check", "FAIL", `Treatment date is within the ${policy.waiting_periods.initial_waiting}-day initial waiting period (joined ${Math.round(diffDays)} days prior to treatment)`);
    } else {
        addStep("Initial Waiting Period Check", "PASS", `Joined ${Math.round(diffDays)} days prior to treatment (initial ${policy.waiting_periods.initial_waiting}-day waiting period completed)`);
    }

    // Diabetes waiting period
    if (diagnosis.toLowerCase().includes("diabetes")) {
        if (diffDays < policy.waiting_periods.specific_ailments.diabetes) {
            result.decision = "REJECTED";
            result.rejection_reasons.push("WAITING_PERIOD");
            result.notes.push("Diabetes waiting period not completed");
            addStep("Diabetes Specific Waiting Period Check", "FAIL", `Diabetes requires a ${policy.waiting_periods.specific_ailments.diabetes}-day waiting period (joined ${Math.round(diffDays)} days prior)`);
        } else {
            addStep("Diabetes Specific Waiting Period Check", "PASS", `Diabetes waiting period completed (${Math.round(diffDays)} days active)`);
        }
    }

    // Hypertension waiting period
    if (diagnosis.toLowerCase().includes("hypertension")) {
        if (diffDays < policy.waiting_periods.specific_ailments.hypertension) {
            result.decision = "REJECTED";
            result.rejection_reasons.push("WAITING_PERIOD");
            result.notes.push("Hypertension waiting period not completed");
            addStep("Hypertension Specific Waiting Period Check", "FAIL", `Hypertension requires a ${policy.waiting_periods.specific_ailments.hypertension}-day waiting period (joined ${Math.round(diffDays)} days prior)`);
        } else {
            addStep("Hypertension Specific Waiting Period Check", "PASS", `Hypertension waiting period completed (${Math.round(diffDays)} days active)`);
        }
    }

    // ===============================
    // STEP 2: DOCUMENT VALIDATION
    // ===============================
    if (!documents.prescription) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("MISSING_DOCUMENTS");
        addStep("Document Completeness: Prescription", "FAIL", "Doctor prescription is missing from the submission");
    } else {
        addStep("Document Completeness: Prescription", "PASS", "Valid doctor prescription found");
    }

    if (!documents.bill) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("MISSING_DOCUMENTS");
        addStep("Document Completeness: Bill", "FAIL", "Itemized medical bill or receipt is missing from the submission");
    } else {
        addStep("Document Completeness: Bill", "PASS", "Itemized medical bill found");
    }

    // Doctor registration validation
    const doctorRegex = /^(?:[A-Z]{2}|AYUR|HOME|UNANI)\/(?:[A-Z]{2}\/)?\d+\/\d{4}$/;
    if (!doctorRegex.test(doctorReg)) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("DOCTOR_REG_INVALID");
        addStep("Doctor License Verification", "FAIL", `Doctor registration code '${doctorReg || 'None'}' is invalid or missing`);
    } else {
        addStep("Doctor License Verification", "PASS", `Doctor registration code '${doctorReg}' is verified and valid`);
    }

    if (extractedData.documents_legible === false) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("ILLEGIBLE_DOCUMENTS");
        addStep("Document Legibility Check", "FAIL", "Submitted document files are blurry, cutoff, or illegible");
    } else {
        addStep("Document Legibility Check", "PASS", "Submitted document files are clear and legible");
    }

    if (extractedData.date_mismatch === true) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("DATE_MISMATCH");
        addStep("Billing Date Validation", "FAIL", "Discrepancy detected between treatment date and receipt date");
    } else {
        addStep("Billing Date Validation", "PASS", "Treatment and billing dates are aligned");
    }

    if (extractedData.patient_mismatch === true) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("PATIENT_MISMATCH");
        addStep("Patient Identity Validation", "FAIL", "Discrepancy detected: Patient name on files does not match policy card holder");
    } else {
        addStep("Patient Identity Validation", "PASS", "Patient name matches policy records");
    }

    // ===============================
    // STEP 3: COVERAGE VERIFICATION & EXCLUSIONS
    // ===============================
    let hasExclusion = false;
    if (
        diagnosis.toLowerCase().includes("cosmetic") ||
        diagnosis.toLowerCase().includes("whitening")
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("COSMETIC_PROCEDURE");
        addStep("Medical Exclusions Review", "FAIL", "Cosmetic whitening and aesthetic procedures are excluded from OPD coverage");
        hasExclusion = true;
    }

    if (diagnosis.toLowerCase().includes("experimental")) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("EXPERIMENTAL_TREATMENT");
        addStep("Medical Exclusions Review", "FAIL", "Experimental or unproven clinical procedures are not covered");
        hasExclusion = true;
    }

    if (
        diagnosis.toLowerCase().includes("weight loss") ||
        diagnosis.toLowerCase().includes("obesity")
    ) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("SERVICE_NOT_COVERED");
        addStep("Medical Exclusions Review", "FAIL", "Weight loss programs and obesity management are excluded");
        hasExclusion = true;
    }

    if (diagnosis.toLowerCase().includes("hiv")) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("EXCLUDED_CONDITION");
        addStep("Medical Exclusions Review", "FAIL", "HIV/AIDS care is excluded under the OPD standard scheme");
        hasExclusion = true;
    }

    if (!hasExclusion) {
        addStep("Medical Exclusions Review", "PASS", "Diagnosis does not match any excluded conditions");
    }

    // Itemized deductions for cosmetic or excluded procedures in bill items
    let itemizedDeductions = 0;
    Object.keys(billItems).forEach(key => {
        if (key.toLowerCase().includes("whitening") || key.toLowerCase().includes("cosmetic")) {
            itemizedDeductions += billItems[key];
            result.rejection_reasons.push(`EXCLUDED_ITEM: ${key.replace(/_/g, ' ')}`);
        }
    });

    if (itemizedDeductions > 0) {
        if (result.decision !== "REJECTED") {
            result.decision = "PARTIAL";
            result.approved_amount -= itemizedDeductions;
            result.notes.push(`Cosmetic/excluded procedure cost of ₹${itemizedDeductions} deducted`);
        }
        addStep("Itemized Charge Exclusion", "WARNING", `₹${itemizedDeductions} deducted for cosmetic whitening charges`);
    } else {
        addStep("Itemized Charge Exclusion", "PASS", "No cosmetic or excluded line items found on bill");
    }

    // ===============================
    // MRI PRE-AUTH CHECK
    // ===============================
    if (diagnosis.toLowerCase().includes("mri")) {
        if (!extractedData.pre_auth) {
            result.decision = "REJECTED";
            result.rejection_reasons.push("PRE_AUTH_MISSING");
            addStep("MRI Pre-Authorization Check", "FAIL", "MRI requires pre-authorization, which was not obtained");
        } else {
            addStep("MRI Pre-Authorization Check", "PASS", "Pre-authorization verified for MRI procedure");
        }
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
        addStep("Per-Claim Limit Check", "FAIL", `Claim amount ₹${result.approved_amount} exceeds limit of ₹${effectiveLimit}`);
    } else {
        addStep("Per-Claim Limit Check", "PASS", `Approved amount is within the limit of ₹${effectiveLimit}`);
    }

    // Annual limit
    const totalYearlyClaims =
        (extractedData.previous_claims_amount || 0) + totalAmount;

    if (totalYearlyClaims > policy.coverage_details.annual_limit) {
        result.decision = "REJECTED";
        result.rejection_reasons.push("ANNUAL_LIMIT_EXCEEDED");
        addStep("Annual Cap Check", "FAIL", `Yearly claims total ₹${totalYearlyClaims} (exceeds ₹${policy.coverage_details.annual_limit} annual cap)`);
    } else {
        addStep("Annual Cap Check", "PASS", `Yearly claims total of ₹${totalYearlyClaims} is within the annual cap`);
    }

    // Consultation sub-limit (only if not already rejected)
    if (
        extractedData.consultation_fee >
        policy.coverage_details.consultation_fees.sub_limit
    ) {
        if (result.decision !== "REJECTED") {
            result.decision = "PARTIAL";
            result.approved_amount = policy.coverage_details.consultation_fees.sub_limit;
            result.notes.push("Consultation sub-limit applied");
        }
        addStep("Consultation Capping Sub-limit", "WARNING", `Consultation fee of ₹${extractedData.consultation_fee} exceeds cap (capped at ₹${policy.coverage_details.consultation_fees.sub_limit})`);
    } else {
        addStep("Consultation Capping Sub-limit", "PASS", `Consultation fee of ₹${extractedData.consultation_fee || 0} is within limits`);
    }

    // ===============================
    // CO-PAY & NETWORK HOSPITAL CHECKS
    // ===============================
    const hospitalName = extractedData.hospital || extractedData.hospital_name || "";
    const isNetwork = policy.network_hospitals.some(h => 
        hospitalName.toLowerCase().includes(h.toLowerCase()) || 
        h.toLowerCase().includes(hospitalName.toLowerCase())
    ) && hospitalName !== "";

    if (isNetwork) {
        addStep("Hospital Network Review", "PASS", `Hospital '${extractedData.hospital}' is in network list`);
    } else if (extractedData.hospital) {
        addStep("Hospital Network Review", "WARNING", `Hospital '${extractedData.hospital}' is out-of-network`);
    }

    if (
        extractedData.consultation_fee &&
        result.decision === "APPROVED" &&
        !isNetwork &&
        !extractedData.cashless_request &&
        !isAlternative
    ) {
        const copay =
            (totalAmount *
                policy.coverage_details.consultation_fees.copay_percentage) /
            100;

        result.approved_amount -= copay;
        result.notes.push(`Co-pay deducted: ₹${copay}`);
        addStep("Co-pay Deduction", "WARNING", `Non-network co-pay of ${policy.coverage_details.consultation_fees.copay_percentage}% deducted (-₹${copay})`);
    } else if (extractedData.consultation_fee && result.decision === "APPROVED") {
        if (isAlternative) {
            addStep("Co-pay Deduction", "PASS", "Co-pay not applicable for alternative medicine treatments");
        } else {
            addStep("Co-pay Deduction", "PASS", "Co-pay waived due to network hospital / cashless request");
        }
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
        addStep("Medical Necessity Review", "FAIL", "No clear diagnosis or medical symptom extracted from records");
    } else {
        addStep("Medical Necessity Review", "PASS", `Diagnosis '${diagnosis}' represents a covered clinical condition`);
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
        addStep("Submission Timeline Check", "FAIL", `Submitted ${Math.round(submissionGap)} days after treatment (exceeds ${policy.claim_requirements.submission_timeline_days}-day limit)`);
    } else {
        addStep("Submission Timeline Check", "PASS", `Submitted ${Math.round(submissionGap)} days after treatment (within ${policy.claim_requirements.submission_timeline_days}-day window)`);
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
        addStep("Minimum Claim Size Check", "FAIL", `Claim amount ₹${totalAmount} is below minimum requirement of ₹${policy.claim_requirements.minimum_claim_amount}`);
    } else {
        addStep("Minimum Claim Size Check", "PASS", `Claim amount ₹${totalAmount} is above minimum limit of ₹${policy.claim_requirements.minimum_claim_amount}`);
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
        addStep("Same-day Frequency Check", "WARNING", `Multiple claims same-day alert: ${extractedData.previous_claims_same_day} claims filed today`);
    } else {
        addStep("Same-day Frequency Check", "PASS", "No same-day submission frequency alarms triggered");
    }

    // High value claims
    if (totalAmount > 25000) {
        result.decision = "MANUAL_REVIEW";
        result.notes.push(
            "High value claim requires manual review"
        );
        addStep("Claim Value Verification", "WARNING", "Claim exceeds ₹25,000 threshold and requires administrative sign-off");
    } else {
        addStep("Claim Value Verification", "PASS", "Claim size is below high-value auditing thresholds");
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
        addStep("Network Partner Discount", "PASS", `Discount of ${policy.coverage_details.consultation_fees.network_discount}% applied (-₹${discount})`);
    }

    // ===============================
    // DYNAMIC CONFIDENCE SCORE CALCULATION
    // ===============================
    let dynamicScore = 1.0;
    
    if (extractedData.documents_legible === false) dynamicScore -= 0.50;
    if (!extractedData.patient_name) dynamicScore -= 0.15;
    if (!extractedData.doctor_name) dynamicScore -= 0.10;
    if (!extractedData.hospital_name && !extractedData.hospital) dynamicScore -= 0.10;
    if (!extractedData.doctor_reg) {
        dynamicScore -= 0.15;
    } else if (!doctorRegex.test(doctorReg)) {
        dynamicScore -= 0.10;
    }
    
    if (extractedData.documents) {
        if (!extractedData.documents.prescription) dynamicScore -= 0.20;
        if (!extractedData.documents.bill) dynamicScore -= 0.20;
    }
    
    if (extractedData.date_mismatch === true) dynamicScore -= 0.15;
    if (extractedData.patient_mismatch === true) dynamicScore -= 0.20;
    if (extractedData.previous_claims_same_day && extractedData.previous_claims_same_day >= 3) dynamicScore -= 0.30;
    if (totalAmount > 25000) dynamicScore -= 0.15;
    
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

    if (
        result.rejection_reasons.length === 0 &&
        result.notes.length === 0
    ) {
        result.notes.push("All validations passed");
    }

    // Set the validation steps list
    result.validation_steps = validationSteps;

    return result;
}

module.exports = adjudicate;
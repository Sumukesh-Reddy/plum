const fs = require('fs');
const path = require('path');
const adjudicate = require('../adjudicator');

// Load test cases
const testCasesPath = path.join(__dirname, '..', 'test_cases.json');
const { test_cases: testCases } = JSON.parse(fs.readFileSync(testCasesPath, 'utf8'));

// Map test_cases.json schema to adjudicator extractedData schema
const mapInputToExtractedData = (input) => {
  const prescription = input.documents?.prescription || {};
  const bill = input.documents?.bill || {};
  
  return {
    claim_id: input.case_id || 'TC_TEST',
    total_amount: input.claim_amount || 0,
    diagnosis: prescription.diagnosis || '',
    doctor_reg: prescription.doctor_reg || '',
    doctor_name: prescription.doctor_name || '',
    hospital: input.hospital || '',
    documents: {
      prescription: !!input.documents?.prescription,
      bill: !!input.documents?.bill
    },
    treatment_date: input.treatment_date || '2024-11-01',
    submission_date: input.treatment_date || '2024-11-01', // Assume same-day submission
    member_join_date: input.member_join_date || '2024-01-01',
    policy_active: input.policy_active !== false,
    member_covered: input.member_covered !== false,
    documents_legible: input.documents_legible !== false,
    pre_auth: input.pre_auth !== false,
    consultation_fee: bill.consultation_fee || 0,
    bill: bill,
    procedures: prescription.procedures || [],
    previous_claims_amount: input.previous_claims_amount || 0,
    previous_claims_same_day: input.previous_claims_same_day || 0
  };
};

console.log('===========================================================');
console.log('🧪 RUNNING ADJUDICATION RULES ENGINE EVALUATION');
console.log(`Loaded ${testCases.length} test cases from test_cases.json`);
console.log('===========================================================\n');

let correctDecisions = 0;
let totalAmountError = 0;

const classes = ['APPROVED', 'REJECTED', 'PARTIAL', 'MANUAL_REVIEW'];
const stats = {};
classes.forEach(c => {
  stats[c] = { tp: 0, fp: 0, fn: 0, tn: 0 };
});

const resultsTable = [];

testCases.forEach((tc) => {
  const mappedData = mapInputToExtractedData(tc.input_data);
  const result = adjudicate(mappedData);
  
  const expected = tc.expected_output.decision;
  const actual = result.decision;
  
  const expectedAmt = tc.expected_output.approved_amount || 0;
  const actualAmt = result.approved_amount || 0;
  
  const decisionMatch = expected === actual;
  if (decisionMatch) correctDecisions++;
  else {
    console.log(`\n❌ FAIL DETAILS for ${tc.case_id}:`);
    console.log(`   Expected Decision: ${expected}`);
    console.log(`   Actual Decision:   ${actual}`);
    console.log(`   Rejection Reasons: ${JSON.stringify(result.rejection_reasons)}`);
    console.log(`   Notes:             ${JSON.stringify(result.notes)}\n`);
  }
  
  totalAmountError += Math.abs(expectedAmt - actualAmt);
  
  // Calculate classification metrics components
  classes.forEach(c => {
    if (expected === c && actual === c) stats[c].tp++;
    else if (expected !== c && actual === c) stats[c].fp++;
    else if (expected === c && actual !== c) stats[c].fn++;
    else stats[c].tn++;
  });
  
  resultsTable.push({
    id: tc.case_id,
    name: tc.case_name,
    expectedDec: expected,
    actualDec: actual,
    expectedAmt,
    actualAmt,
    status: decisionMatch ? '✅ PASS' : '❌ FAIL'
  });
});

// Print Results Table
console.log('📋 INDIVIDUAL TEST CASE RESULTS:');
console.log('-----------------------------------------------------------------------------------------------------');
console.log('| ID    | Case Name                          | Expected   | Actual     | Exp. Amt | Act. Amt | Status |');
console.log('-----------------------------------------------------------------------------------------------------');
resultsTable.forEach(row => {
  const nameCol = row.name.padEnd(34).substring(0, 34);
  const expCol = row.expectedDec.padEnd(10);
  const actCol = row.actualDec.padEnd(10);
  const expAmtCol = `₹${row.expectedAmt}`.padStart(8);
  const actAmtCol = `₹${row.actualAmt}`.padStart(8);
  console.log(`| ${row.id} | ${nameCol} | ${expCol} | ${actCol} | ${expAmtCol} | ${actAmtCol} | ${row.status} |`);
});
console.log('-----------------------------------------------------------------------------------------------------\n');

// Compute Aggregate Metrics
const accuracy = correctDecisions / testCases.length;
const mae = totalAmountError / testCases.length;

console.log('📈 AGGREGATE EVALUATION METRICS:');
console.log('-------------------------------------------');
console.log(`Decision Accuracy : ${(accuracy * 100).toFixed(2)}% (${correctDecisions}/${testCases.length} cases)`);
console.log(`Approved Amt MAE  : ₹${mae.toFixed(2)}`);
console.log('-------------------------------------------\n');

console.log('📊 CLASS-LEVEL PERFORMANCE METRICS:');
console.log('-----------------------------------------------------------------');
console.log('| Decision Class | Precision | Recall     | F1-Score   | Support |');
console.log('-----------------------------------------------------------------');

classes.forEach(c => {
  const { tp, fp, fn } = stats[c];
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  const support = tp + fn;
  
  const classCol = c.padEnd(14);
  const precCol = (precision * 100).toFixed(1).padStart(8) + '%';
  const recCol = (recall * 100).toFixed(1).padStart(8) + '%';
  const f1Col = (f1 * 100).toFixed(1).padStart(8) + '%';
  const suppCol = support.toString().padStart(7);
  
  console.log(`| ${classCol} | ${precCol} | ${recCol} | ${f1Col} | ${suppCol} |`);
});
console.log('-----------------------------------------------------------------\n');
console.log('Evaluation finished successfully! 🚀');
console.log('===========================================================');

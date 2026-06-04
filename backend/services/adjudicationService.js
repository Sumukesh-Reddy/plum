const adjudicate = require('../adjudicator');

const processAdjudication = (extractedData, claimId) => {
  try {
    // Merge in the claim ID
    const dataWithId = {
      ...extractedData,
      claim_id: claimId,
      total_amount: extractedData.bill_amount || 0
    };

    const result = adjudicate(dataWithId);

    
    if (result.confidence_score > 1) {
      result.confidence_score = result.confidence_score / 100;
    }

    return result;
  } catch (error) {
    console.error('Adjudication error:', error);
    throw new Error(`Adjudication failed: ${error.message}`);
  }
};

module.exports = { processAdjudication };

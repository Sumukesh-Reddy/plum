const Tesseract = require('tesseract.js');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const extractTextFromImage = async (filePath) => {
  try {
    console.log(`Running OCR on image: ${filePath}`);
    const result = await Tesseract.recognize(filePath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\rOCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    console.log('\nOCR complete.');
    return result.data.text;
  } catch (error) {
    console.error('OCR error:', error);
    throw new Error(`OCR extraction failed: ${error.message}`);
  }
};

const extractTextFromPDF = async (filePath) => {
  try {
    console.log(`Parsing PDF: ${filePath}`);
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    console.log(`PDF parsed. Pages: ${data.numpages}`);
    return data.text;
  } catch (error) {
    console.error('PDF parse error:', error);
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
};

const extractText = async (filePath, mimetype) => {
  if (mimetype === 'application/pdf') {
    return await extractTextFromPDF(filePath);
  } else if (['image/jpeg', 'image/jpg', 'image/png'].includes(mimetype)) {
    return await extractTextFromImage(filePath);
  } else {
    throw new Error(`Unsupported file type: ${mimetype}`);
  }
};

const cleanText = (text) => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E\n]/g, '')
    .trim()
    .substring(0, 4000); // Limit for token efficiency
};

module.exports = { extractText, cleanText };

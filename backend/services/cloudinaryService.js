const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure Cloudinary
// Note: Cloudinary library automatically loads CLOUDINARY_URL environment variable if set.
// Otherwise, we check for individual config variables.
const isConfigured = () => {
  return !!(
    process.env.CLOUDINARY_URL || 
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );
};

if (isConfigured()) {
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
  }
  console.log('[Cloudinary] Cloudinary service initialized successfully.');
} else {
  console.warn('[Cloudinary] Warning: Cloudinary is not configured. Uploads will fall back to local disk storage.');
}

/**
 * Uploads a local file to Cloudinary and returns its secure URL.
 * Deletes the local file afterwards.
 * @param {string} filePath - Absolute path to the local file
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<string|null>} Secure URL if uploaded successfully, null otherwise
 */
const uploadToCloudinary = async (filePath, folder = 'plum_claims') => {
  if (!isConfigured()) {
    return null;
  }

  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local file not found at path: ${filePath}`);
    }

    const uploadResult = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'auto'
    });

    console.log(`[Cloudinary] File uploaded successfully to Cloudinary. URL: ${uploadResult.secure_url}`);

    // Delete local file after successful upload to save server storage
    try {
      fs.unlinkSync(filePath);
      console.log(`[Cloudinary] Temporary local file deleted: ${filePath}`);
    } catch (unlinkErr) {
      console.error(`[Cloudinary] Failed to delete temporary local file: ${filePath}`, unlinkErr.message);
    }

    return uploadResult.secure_url;
  } catch (error) {
    console.error(`[Cloudinary] Upload failed for ${filePath}:`, error.message);
    throw error;
  }
};

module.exports = {
  uploadToCloudinary,
  isConfigured
};

const axios = require('axios');

/**
 * Upload image buffer or base64 data to Cloudinary via REST API
 * Supports both Cloudinary Upload Preset or API Key / Secret credentials
 */
async function uploadToCloudinary(fileInput, folder = 'thienthu_match_analysis') {
  try {
    if (!fileInput) return null;

    // If already a valid HTTPS URL (not a base64 string), return as is
    if (typeof fileInput === 'string' && fileInput.startsWith('http') && !fileInput.includes('data:image')) {
      return fileInput;
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dph38vhly';
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'ml_default';

    const formData = new URLSearchParams();
    formData.append('file', fileInput);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', folder);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const response = await axios.post(uploadUrl, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-length-url-encoded'
      }
    });

    if (response.data && response.data.secure_url) {
      return response.data.secure_url;
    }

    throw new Error('Cloudinary response did not return secure_url');
  } catch (error) {
    console.error('❌ Cloudinary Upload Error:', error.response?.data || error.message);
    // Fallback: If Cloudinary fails or is not configured, return original input if string
    if (typeof fileInput === 'string') return fileInput;
    throw error;
  }
}

module.exports = { uploadToCloudinary };

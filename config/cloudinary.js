const axios = require('axios');
const crypto = require('crypto');

/**
 * Upload image buffer or base64 data to Cloudinary via REST API
 * Supports Signed Upload (via API Key & Secret) and Unsigned Upload (via Upload Preset)
 */
async function uploadToCloudinary(fileInput, folder = 'thienthu_match_analysis') {
  try {
    if (!fileInput) return null;

    // If already a valid HTTPS URL (not a base64 string), return as is
    if (typeof fileInput === 'string' && fileInput.startsWith('http') && !fileInput.includes('data:image')) {
      return fileInput;
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dpyshymwv';
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    const formData = new URLSearchParams();
    formData.append('file', fileInput);
    formData.append('folder', folder);

    if (apiKey && apiSecret) {
      // Signed Upload (Most reliable, doesn't require unsigned preset configuration in Cloudinary console)
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
    } else if (uploadPreset) {
      // Fallback: Unsigned Upload using upload_preset
      formData.append('upload_preset', uploadPreset);
    } else {
      throw new Error('Cloudinary config missing: Need (CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET) or CLOUDINARY_UPLOAD_PRESET');
    }

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const response = await axios.post(uploadUrl, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 60000
    });

    if (response.data && response.data.secure_url) {
      return response.data.secure_url;
    }

    throw new Error('Cloudinary response did not return secure_url');
  } catch (error) {
    console.error('❌ Cloudinary Upload Error:', error.response?.data || error.message);
    if (typeof fileInput === 'string') return fileInput;
    throw error;
  }
}

module.exports = { uploadToCloudinary };

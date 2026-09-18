const express = require('express');
const router = express.Router();
const Skill = require('../models/Skill');
const { uploadToCloudinary } = require('../config/cloudinary');

// GET /api/skills - Lấy danh sách kỹ năng
router.get('/', async (req, res) => {
  try {
    const skills = await Skill.find().sort({ createdAt: 1 }).lean();
    res.json(skills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/skills/upload-icon - Upload riêng icon lên Cloudinary
router.post('/upload-icon', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'Dữ liệu ảnh không hợp lệ.' });
    }
    const cdnUrl = await uploadToCloudinary(image, 'thienthu_skills');
    return res.json({ success: true, url: cdnUrl });
  } catch (error) {
    console.error('Lỗi upload icon kỹ năng lên Cloudinary:', error);
    return res.status(500).json({ success: false, message: 'Lỗi upload ảnh lên Cloudinary.' });
  }
});

// POST /api/skills - Thêm kỹ năng mới (tự động upload lên Cloudinary)
router.post('/', async (req, res) => {
  const { name, iconUrl, category, description } = req.body;
  if (!name || !iconUrl) {
    return res.status(400).json({ message: 'Tên kỹ năng và ảnh icon là bắt buộc' });
  }

  try {
    let finalIconUrl = iconUrl;
    // If it's a base64 string or file data, upload directly to Cloudinary
    if (typeof iconUrl === 'string' && (iconUrl.startsWith('data:image') || !iconUrl.startsWith('http'))) {
      finalIconUrl = await uploadToCloudinary(iconUrl, 'thienthu_skills');
    }

    const skill = new Skill({
      name: name.trim(),
      iconUrl: finalIconUrl,
      category: category || 'Tuyệt Kỹ',
      description: description || '',
    });
    const saved = await skill.save();
    res.status(201).json(saved);
  } catch (error) {
    console.error('Lỗi lưu kỹ năng:', error);
    res.status(500).json({ message: error.message });
  }
});

// DELETE /api/skills/:id - Xoá kỹ năng
router.delete('/:id', async (req, res) => {
  try {
    await Skill.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xoá kỹ năng thành công' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

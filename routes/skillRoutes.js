const express = require('express');
const router = express.Router();
const Skill = require('../models/Skill');

// GET /api/skills - Lấy danh sách kỹ năng
router.get('/', async (req, res) => {
  try {
    const skills = await Skill.find().sort({ createdAt: 1 });
    res.json(skills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/skills - Thêm kỹ năng mới (có thể upload ảnh base64 hoặc URL)
router.post('/', async (req, res) => {
  const { name, iconUrl, category, description } = req.body;
  if (!name || !iconUrl) {
    return res.status(400).json({ message: 'Tên kỹ năng và icon là bắt buộc' });
  }

  try {
    const skill = new Skill({
      name: name.trim(),
      iconUrl,
      category: category || 'Chung',
      description: description || '',
    });
    const saved = await skill.save();
    res.status(201).json(saved);
  } catch (error) {
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

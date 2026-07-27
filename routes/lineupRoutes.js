const express = require('express');
const router = express.Router();
const Lineup = require('../models/Lineup');

// GET /api/lineup/:eventId - Lấy sơ đồ đội hình đã lưu của event
router.get('/:eventId', async (req, res) => {
  try {
    const lineup = await Lineup.findOne({ eventId: req.params.eventId });
    res.json(lineup || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST /api/lineup/:eventId - Lưu hoặc Cập nhật sơ đồ đội hình
router.post('/:eventId', async (req, res) => {
  const { eventId } = req.params;
  const { title, divisions, updatedBy } = req.body;

  try {
    const lineup = await Lineup.findOneAndUpdate(
      { eventId },
      { title, divisions, updatedBy, updatedAt: Date.now() },
      { new: true, upsert: true } // Nếu chưa có thì tự tạo mới
    );
    res.json(lineup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
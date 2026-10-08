const express = require('express');
const router = express.Router();
const axios = require('axios');
const Lineup = require('../models/Lineup');

// GET /api/lineup/:eventId - Lấy sơ đồ đội hình đã lưu của event
router.get('/:eventId', async (req, res) => {
  try {
    const lineup = await Lineup.findOne({ eventId: req.params.eventId }).lean();
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

    // Nếu có cấu hình BOT_API_URL thì gọi webhook trực tiếp (mặc định Bot tự đồng bộ qua MongoDB Watcher)
    if (process.env.BOT_API_URL) {
      axios.post(`${process.env.BOT_API_URL}/api/notify-lineup`, {
        eventId,
        lineup: { title, divisions, updatedBy },
      }).catch((err) => {
        console.warn(`[Backend Lineup] Thông báo webhook bot không thành công: ${err.message}`);
      });
    }

    res.json(lineup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
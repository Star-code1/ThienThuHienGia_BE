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

    // Kích hoạt gửi thông báo đội hình & skill sang Discord Bot (chạy ngầm không chặn response)
    const botApiUrl = process.env.BOT_API_URL || 'http://localhost:3001';
    axios.post(`${botApiUrl}/api/notify-lineup`, {
      eventId,
      lineup: { title, divisions, updatedBy },
    }).catch((err) => {
      console.warn(`[Backend Lineup] Không thể kích hoạt bot thông báo DM: ${err.message}`);
    });

    res.json(lineup);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const Event = require('../models/Event');

// GET /api/events/active - Lấy danh sách các Event đang active
router.get('/active', async (req, res) => {
  try {
    const events = await Event.find({ active: true }).sort({ date: -1 }).lean();
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
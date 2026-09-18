const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');

// GET /api/attendance/:eventId - Lấy danh sách thành viên điểm danh của 1 event
router.get('/:eventId', async (req, res) => {
  try {
    const attendances = await Attendance.find({ eventId: req.params.eventId }).lean();
    res.json(attendances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
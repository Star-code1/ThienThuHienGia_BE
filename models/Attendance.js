const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  displayName: { type: String },
  className: { type: String },
  roleName: { type: String },
  role: { type: String },
  status: {
    type: String,
    enum: ['present', 'bench', 'late', 'tentative', 'absent'],
    default: 'present',
  },
  // Đánh dấu Vote mà không đánh (No-Show) để trừ 3 điểm
  noShow: { type: Boolean, default: false },
  noShowMarkedBy: { type: String },
  noShowMarkedAt: { type: Date },
  timestamp: { type: Date, default: Date.now },
});

attendanceSchema.index({ eventId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
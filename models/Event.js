const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  messageId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  title: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  remindedMilestones: { type: [Number], default: [] },
  notified30m: { type: Boolean, default: false },
  notified24hTentative: { type: Boolean, default: false },
});

module.exports = mongoose.model('Event', eventSchema);
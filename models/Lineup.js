const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  slotIndex: { type: Number, required: true },
  userId: { type: String, default: null },
  displayName: { type: String, default: '' },
  roleOrClass: { type: String, default: '' },
  note: { type: String, default: '' },
});

const teamSchema = new mongoose.Schema({
  teamName: { type: String, required: true },
  teamTag: { type: String, default: '' },
  slots: [slotSchema],
});

const divisionSchema = new mongoose.Schema({
  divisionName: { type: String, required: true },
  teams: [teamSchema],
});

const lineupSchema = new mongoose.Schema({
  eventId: { type: String, required: true, unique: true },
  title: { type: String, default: 'ĐỘI HÌNH BANG CHIẾN' },
  divisions: [divisionSchema],
  updatedBy: { type: String },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Lineup', lineupSchema);
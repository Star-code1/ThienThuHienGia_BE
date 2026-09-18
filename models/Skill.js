const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  name: { type: String, required: true },
  iconUrl: { type: String, required: true },
  category: { type: String, default: 'Chung' },
  description: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Skill', skillSchema);

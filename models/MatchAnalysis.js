const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  caption: { type: String, default: '' }
}, { _id: false });

const matchAnalysisSchema = new mongoose.Schema(
  {
    matchTitle: {
      type: String,
      required: true,
      trim: true
    },
    eventDate: {
      type: Date,
      default: Date.now
    },
    result: {
      type: String,
      enum: ['win', 'loss', 'draw'],
      default: 'loss'
    },
    mistakes: {
      type: String,
      required: true
    },
    improvements: {
      type: String,
      default: ''
    },
    images: [imageSchema],
    author: {
      discordId: { type: String, required: true },
      name: { type: String, required: true },
      avatar: { type: String, default: '' },
      className: { type: String, default: 'Bang Chúng' }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('MatchAnalysis', matchAnalysisSchema);

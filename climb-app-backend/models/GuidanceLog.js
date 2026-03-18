const mongoose = require('mongoose');

const guidanceLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['cue_issued', 'hold_reached', 'scan_saved', 'session_completed', 'recalibrate'],
      required: true,
    },
    message: { type: String, required: true },
    timestamp: { type: Date, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('GuidanceLog', guidanceLogSchema);

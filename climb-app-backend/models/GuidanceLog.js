const mongoose = require('mongoose');

const guidanceLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['cue_issued', 'hold_reached', 'scan_saved', 'session_completed', 'recalibrate', 'safety_state_changed'],
      required: true,
    },
    message: { type: String, required: true },
    timestamp: { type: Date, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    collection: 'guidanceLogs',
    timestamps: true,
  },
);

guidanceLogSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

guidanceLogSchema.set('toObject', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.models.GuidanceLog || mongoose.model('GuidanceLog', guidanceLogSchema);

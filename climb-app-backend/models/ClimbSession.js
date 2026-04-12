const mongoose = require('mongoose');

const routeHoldSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    color: { type: String, required: true },
    xPct: { type: Number, required: true },
    yPct: { type: Number, required: true },
    x1Pct: { type: Number },
    y1Pct: { type: Number },
    x2Pct: { type: Number },
    y2Pct: { type: Number },
    confidence: { type: Number, required: true },
    role: { type: String, default: 'intermediate' },
    size: { type: String, default: 'm' },
    radiusPct: { type: Number },
  },
  { _id: false },
);

const routePlanSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    scanId: { type: String, required: true },
    color: { type: String, required: true },
    difficultyPreference: { type: String, required: true },
    holdIds: [{ type: String, required: true }],
    holds: { type: [routeHoldSchema], default: [] },
    summary: { type: String, default: '' },
    estimatedMoves: { type: Number, default: 0 },
    semantics: {
      plannerVersion: { type: String, default: '' },
      feedbackReady: { type: Boolean, default: false },
      reviewState: { type: String, default: 'auto-approved' },
      startType: { type: String, default: 'single-start' },
      startLabel: { type: String, default: '' },
      finishType: { type: String, default: 'single-finish' },
      finishLabel: { type: String, default: '' },
      startHoldIds: { type: [String], default: [] },
      finishHoldIds: { type: [String], default: [] },
      supportHoldIds: { type: [String], default: [] },
      reachabilityScore: { type: Number, default: 0 },
      stabilityScore: { type: Number, default: 0 },
      reviewSummary: { type: String, default: '' },
      setterNotes: { type: [String], default: [] },
      reviewHints: { type: [String], default: [] },
    },
  },
  { _id: false },
);

const climbSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    scanId: { type: String, required: true },
    routeId: { type: String, default: '' },
    selectedColor: { type: String, required: true },
    difficulty: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    cueIndex: { type: Number, default: 0 },
    completed: { type: Boolean, default: false },
    elapsedSeconds: { type: Number, default: 0 },
    currentTargetHoldId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'guiding', 'paused', 'completed'],
      default: 'draft',
    },
    plannedRoute: { type: routePlanSchema, default: null },
    summaryStats: {
      holdsReached: { type: Number, default: 0 },
      totalHolds: { type: Number, default: 0 },
      cueCount: { type: Number, default: 0 },
      recalibrationCount: { type: Number, default: 0 },
      source: {
        type: String,
        enum: ['camera', 'upload'],
        default: 'camera',
      },
    },
  },
  {
    collection: 'climbSessions',
    timestamps: true,
  },
);

climbSessionSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

climbSessionSchema.set('toObject', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.models.ClimbSession || mongoose.model('ClimbSession', climbSessionSchema);

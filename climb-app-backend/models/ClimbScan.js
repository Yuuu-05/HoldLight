const mongoose = require('mongoose');

const holdSchema = new mongoose.Schema(
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

const wallMapSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    source: { type: String, enum: ['camera', 'upload'], default: 'camera' },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    colors: [{ type: String, required: true }],
    scannedAt: { type: Date, required: true },
    scanNotes: [{ type: String }],
    holds: { type: [holdSchema], default: [] },
    analysis: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false },
);

const climbScanSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gymName: { type: String, trim: true, default: 'Unknown gym' },
    availableColors: [{ type: String, required: true }],
    wallMap: { type: wallMapSchema, required: true },
    coverImageUrl: { type: String, default: '' },
  },
  {
    collection: 'climbScans',
    timestamps: true,
  },
);

climbScanSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

climbScanSchema.set('toObject', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.models.ClimbScan || mongoose.model('ClimbScan', climbScanSchema);

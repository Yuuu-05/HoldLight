const mongoose = require('mongoose');

const badgeWallSchema = new mongoose.Schema(
  {
    ownedBadgeIds: [{ type: String, trim: true }],
    visibleBadgeIds: [{ type: String, trim: true }],
  },
  { _id: false },
);

const profileSchema = new mongoose.Schema(
  {
    gender: String,
    height: Number,
    weight: Number,
    birthday: Date,
    climbingExperience: String,
    accessibilityNeeds: String,
    homeGym: String,
    region: String,
    badgeWall: { type: badgeWallSchema, default: () => ({ ownedBadgeIds: [], visibleBadgeIds: [] }) },
  },
  { _id: false },
);

const accessibilityPreferenceSchema = new mongoose.Schema(
  {
    speechEnabled: { type: Boolean, default: true },
    feedbackEnabled: { type: Boolean, default: true },
    highContrast: { type: Boolean, default: false },
    largeText: { type: Boolean, default: false },
    simplifiedMode: { type: Boolean, default: false },
    voiceCommandsEnabled: { type: Boolean, default: false },
    speechRate: { type: Number, default: 1 },
    fontScale: { type: Number, default: 1 },
  },
  { _id: false },
);

const tutorialProgressSchema = new mongoose.Schema(
  {
    completedIds: [{ type: String, trim: true }],
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const notificationPreferencesSchema = new mongoose.Schema(
  {
    readIds: [{ type: String, trim: true }],
    updatedAt: { type: Date, default: null },
  },
  { _id: false },
);

const preferencesSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      enum: ['en', 'zh'],
      default: 'en',
    },
    accessibility: {
      type: accessibilityPreferenceSchema,
      default: () => ({}),
    },
    tutorialProgress: {
      type: tutorialProgressSchema,
      default: () => ({ completedIds: [] }),
    },
    notifications: {
      type: notificationPreferencesSchema,
      default: () => ({ readIds: [] }),
    },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: {
    type: String,
    enum: ['new_user', 'experienced', 'visually_impaired', 'volunteer'],
    required: true,
  },
  profile: { type: profileSchema, default: {} },
  preferences: { type: preferencesSchema, default: () => ({}) },
  posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  likedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  volunteerSessions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'VolunteerPost' }],
  tokenVersion: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

function sanitizeUser(_doc, ret) {
  delete ret.passwordHash;
  delete ret.__v;
  delete ret.tokenVersion;
  return ret;
}

userSchema.set('toJSON', { transform: sanitizeUser });
userSchema.set('toObject', { transform: sanitizeUser });

userSchema.pre('save', function updateTimestamp(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);

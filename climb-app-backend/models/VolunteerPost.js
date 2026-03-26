const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  userId: { type: String, required: true, trim: true },
  userName: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true, maxlength: 2000 },
  status: {
    type: String,
    enum: ['interested', 'accepted', 'completed', 'cancelled'],
    default: 'interested',
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const volunteerPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    location: { type: String, required: true, trim: true, maxlength: 160 },
    sessionTime: { type: Date, required: true },
    difficulty: { type: String, required: true, trim: true, maxlength: 60 },
    notes: { type: String, required: true, trim: true, maxlength: 4000 },
    authorId: { type: String, required: true, trim: true },
    authorName: { type: String, required: true, trim: true },
    applicants: [applicationSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: 'volunteerPosts',
  },
);

function serializeVolunteerPost(_doc, ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;

  ret.applicants = (ret.applicants || []).map((application) => ({
    id: application._id.toString(),
    userId: application.userId,
    userName: application.userName,
    message: application.message,
    status: application.status,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  }));

  return ret;
}

volunteerPostSchema.set('toJSON', { transform: serializeVolunteerPost });
volunteerPostSchema.set('toObject', { transform: serializeVolunteerPost });

volunteerPostSchema.pre('save', function updateTimestamp() {
  this.updatedAt = new Date();
});

module.exports = mongoose.models.VolunteerPost || mongoose.model('VolunteerPost', volunteerPostSchema);

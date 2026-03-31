const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true, trim: true },
    authorName: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    tags: [{ type: String, trim: true }],
    authorId: { type: String, required: true, trim: true },
    authorName: { type: String, required: true, trim: true },
    authorRole: { type: String, required: true, trim: true },
    likedBy: [{ type: String, trim: true }],
    comments: [commentSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: 'posts',
  },
);

function sanitizePost(_doc, ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;

  ret.likedBy = (ret.likedBy || []).map((id) => id.toString());
  ret.comments = (ret.comments || []).map((comment) => ({
    id: comment._id.toString(),
    authorId: comment.authorId,
    authorName: comment.authorName,
    body: comment.body,
    createdAt: comment.createdAt,
  }));

  return ret;
}

postSchema.set('toJSON', { transform: sanitizePost });
postSchema.set('toObject', { transform: sanitizePost });

postSchema.pre('save', function updateTimestamp() {
  this.updatedAt = new Date();
});

module.exports = mongoose.models.Post || mongoose.model('Post', postSchema);

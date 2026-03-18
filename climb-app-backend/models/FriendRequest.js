const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
  fromUserId: { type: String, required: true, trim: true },
  fromUserName: { type: String, required: true, trim: true },
  toUserId: { type: String, required: true, trim: true },
  toUserName: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date, default: null },
});

friendRequestSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    if (!ret.respondedAt) delete ret.respondedAt;
    return ret;
  },
});

module.exports = mongoose.model('FriendRequest', friendRequestSchema);

const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
  userA: { type: String, required: true, trim: true },
  userB: { type: String, required: true, trim: true },
  pairKey: { type: String, required: true, unique: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

friendshipSchema.set('toJSON', {
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Friendship', friendshipSchema);

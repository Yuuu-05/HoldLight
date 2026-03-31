const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true },
    userName: { type: String, required: true, trim: true },
    role: { type: String, required: true, trim: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const invitationSchema = new mongoose.Schema({
  roomId: { type: String, required: true, trim: true },
  roomName: { type: String, required: true, trim: true },
  invitedUserId: { type: String, required: true, trim: true },
  invitedUserName: { type: String, required: true, trim: true },
  invitedById: { type: String, required: true, trim: true },
  invitedByName: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  },
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date, default: null },
});

const messageSchema = new mongoose.Schema({
  userId: { type: String, required: true, trim: true },
  userName: { type: String, required: true, trim: true },
  body: { type: String, required: true, trim: true, maxlength: 3000 },
  createdAt: { type: Date, default: Date.now },
  type: {
    type: String,
    enum: ['chat', 'help', 'plan'],
    default: 'chat',
  },
});

const readStateSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true },
    lastReadAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const roomSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    gymName: { type: String, required: true, trim: true, maxlength: 120 },
    region: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    createdById: { type: String, required: true, trim: true },
    createdByName: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    members: [memberSchema],
    invitations: [invitationSchema],
    messages: [messageSchema],
    readStates: [readStateSchema],
  },
  {
    collection: 'rooms',
  },
);

function serializeRoom(_doc, ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;

  ret.members = (ret.members || []).map((member) => ({
    userId: member.userId,
    userName: member.userName,
    role: member.role,
    joinedAt: member.joinedAt,
  }));

  ret.invitations = (ret.invitations || []).map((invite) => ({
    id: invite._id.toString(),
    roomId: invite.roomId,
    roomName: invite.roomName,
    invitedUserId: invite.invitedUserId,
    invitedUserName: invite.invitedUserName,
    invitedById: invite.invitedById,
    invitedByName: invite.invitedByName,
    status: invite.status,
    createdAt: invite.createdAt,
    respondedAt: invite.respondedAt || undefined,
  }));

  ret.messages = (ret.messages || []).map((message) => ({
    id: message._id.toString(),
    userId: message.userId,
    userName: message.userName,
    body: message.body,
    createdAt: message.createdAt,
    type: message.type,
  }));

  ret.readStates = (ret.readStates || []).map((state) => ({
    userId: state.userId,
    lastReadAt: state.lastReadAt,
  }));

  return ret;
}

roomSchema.set('toJSON', { transform: serializeRoom });
roomSchema.set('toObject', { transform: serializeRoom });

roomSchema.pre('save', function updateTimestamp() {
  this.updatedAt = new Date();
});

module.exports = mongoose.models.Room || mongoose.model('Room', roomSchema);

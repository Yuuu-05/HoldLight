export type RoomInvitationStatus = 'pending' | 'accepted' | 'declined';
export type RoomMessageType = 'chat' | 'help' | 'plan';

export interface RoomMember {
  userId: string;
  userName: string;
  role: string;
  joinedAt: string;
}

export interface RoomInvitation {
  id: string;
  roomId: string;
  roomName: string;
  invitedUserId: string;
  invitedUserName: string;
  invitedById: string;
  invitedByName: string;
  status: RoomInvitationStatus;
  createdAt: string;
  respondedAt?: string;
}

export interface RoomMessage {
  id: string;
  userId: string;
  userName: string;
  body: string;
  createdAt: string;
  type: RoomMessageType;
}

export interface RoomReadState {
  userId: string;
  lastReadAt: string;
}

export interface ClimbingRoom {
  id: string;
  title: string;
  gymName: string;
  region: string;
  description: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  members: RoomMember[];
  invitations: RoomInvitation[];
  messages: RoomMessage[];
  readStates: RoomReadState[];
}

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected';

export interface SocialUser {
  userId: string;
  username: string;
  role: string;
  email?: string;
  homeGym?: string;
  region?: string;
  accessibilityNeeds?: string;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  status: FriendRequestStatus;
  createdAt: string;
  respondedAt?: string;
}

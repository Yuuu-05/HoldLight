import type { RoleValue } from '../constants/roles';

export interface UserBadgeWall {
  ownedBadgeIds?: string[];
  visibleBadgeIds?: string[];
}

export interface UserProfile {
  gender?: string;
  height?: number;
  weight?: number;
  birthday?: string;
  climbingExperience?: string;
  accessibilityNeeds?: string;
  badgeWall?: UserBadgeWall;
}

export interface User {
  _id?: string;
  id?: string;
  username: string;
  email: string;
  role: RoleValue;
  profile?: UserProfile;
  createdAt?: string;
  updatedAt?: string;
}

export function getUserId(user: User | null | undefined) {
  return user?._id || user?.id || '';
}

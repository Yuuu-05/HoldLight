import type { RoleValue } from '../constants/roles';
import type { UserPreferences } from './preferences';

export interface UserProfile {
  gender?: string;
  height?: number;
  weight?: number;
  birthday?: string;
  climbingExperience?: string;
  accessibilityNeeds?: string;
}

export interface User {
  _id?: string;
  id?: string;
  username: string;
  email: string;
  role: RoleValue;
  profile?: UserProfile;
  preferences?: UserPreferences;
  createdAt?: string;
  updatedAt?: string;
}

export function getUserId(user: User | null | undefined) {
  return user?._id || user?.id || '';
}

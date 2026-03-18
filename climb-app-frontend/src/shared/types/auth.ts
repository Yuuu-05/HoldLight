import type { RoleValue } from '../constants/roles';
import type { User, UserProfile } from './user';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  role: RoleValue;
  profile?: UserProfile;
}

export interface AuthSuccessResponse {
  success: boolean;
  token: string;
  user: User;
  message?: string;
}

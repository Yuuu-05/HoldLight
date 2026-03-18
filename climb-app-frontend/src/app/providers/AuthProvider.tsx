import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { env } from '../config/env';
import { loginApi, logoutApi, registerApi } from '../../shared/api/auth.api';
import { getCurrentUserApi, updateCurrentUserApi } from '../../shared/api/users.api';
import { removeStorage, storageKeys, writeStorage, readStorage } from '../../shared/lib/storage';
import type { LoginPayload, RegisterPayload } from '../../shared/types/auth';
import type { User, UserProfile } from '../../shared/types/user';
import type { RoleValue } from '../../shared/constants/roles';

interface AuthContextState {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isUsingDevAuth: boolean;
  isDevAuthBypassAvailable: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  loginAsDevUser: (role?: RoleValue) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (payload: { username?: string; profile?: UserProfile }) => Promise<void>;
}

const AuthContext = createContext<AuthContextState | null>(null);

const DEV_TOKEN_PREFIX = 'dev-auth-token:';

function checkOnboarded(user: User | null) {
  if (!user) return false;
  const profile = user.profile ?? {};
  return Boolean(
    profile.gender &&
    profile.height &&
    profile.weight &&
    profile.birthday &&
    profile.climbingExperience,
  );
}

function isDevAuthToken(token: string | null) {
  return Boolean(token?.startsWith(DEV_TOKEN_PREFIX));
}

function buildDevUser(role: RoleValue = 'new_user'): User {
  return {
    id: `dev-${role}`,
    username: `dev_${role}`,
    email: `dev-${role}@local.test`,
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profile: {
      gender: 'Prefer not to say',
      height: 170,
      weight: 65,
      birthday: '2000-01-01',
      climbingExperience: 'Beginner',
      accessibilityNeeds: role === 'visually_impaired' ? 'Voice guidance and clear focus order' : '',
    },
  };
}

export default function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(() => readStorage<string | null>(storageKeys.token, null));
  const [user, setUser] = useState<User | null>(() => readStorage<User | null>(storageKeys.user, null));
  const [loading, setLoading] = useState<boolean>(!!token);
  const isUsingDevAuth = isDevAuthToken(token);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    if (isDevAuthToken(token)) {
      if (!env.devAuthBypassAvailable) {
        removeStorage(storageKeys.token);
        removeStorage(storageKeys.user);
        removeStorage(storageKeys.devAuthRole);
        setToken(null);
        setUser(null);
        setLoading(false);
        return;
      }

      const storedRole = readStorage<RoleValue>(storageKeys.devAuthRole, user?.role ?? 'new_user');
      const nextUser = user ?? buildDevUser(storedRole);
      setUser(nextUser);
      writeStorage(storageKeys.user, nextUser);
      setLoading(false);
      return;
    }

    getCurrentUserApi()
      .then((currentUser) => {
        setUser(currentUser);
        writeStorage(storageKeys.user, currentUser);
      })
      .catch(() => {
        removeStorage(storageKeys.token);
        removeStorage(storageKeys.user);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const value = useMemo<AuthContextState>(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!token,
      isOnboarded: checkOnboarded(user),
      isUsingDevAuth,
      isDevAuthBypassAvailable: env.devAuthBypassAvailable,
      login: async (payload) => {
        const result = await loginApi(payload);
        setToken(result.token);
        setUser(result.user);
        writeStorage(storageKeys.token, result.token);
        writeStorage(storageKeys.user, result.user);
      },
      register: async (payload) => {
        const result = await registerApi(payload);
        setToken(result.token);
        setUser(result.user);
        writeStorage(storageKeys.token, result.token);
        writeStorage(storageKeys.user, result.user);
      },
      loginAsDevUser: async (role = 'new_user') => {
        if (!env.devAuthBypassAvailable) {
          throw new Error('Development auth bypass is only available in development mode.');
        }

        const nextUser = buildDevUser(role);
        const nextToken = `${DEV_TOKEN_PREFIX}${role}`;
        setToken(nextToken);
        setUser(nextUser);
        writeStorage(storageKeys.token, nextToken);
        writeStorage(storageKeys.user, nextUser);
        writeStorage(storageKeys.devAuthRole, role);
      },
      logout: async () => {
        try {
          if (token && !isDevAuthToken(token)) {
            await logoutApi();
          }
        } finally {
          removeStorage(storageKeys.token);
          removeStorage(storageKeys.user);
          removeStorage(storageKeys.devAuthRole);
          setToken(null);
          setUser(null);
        }
      },
      refreshUser: async () => {
        if (!token || isDevAuthToken(token)) return;
        const nextUser = await getCurrentUserApi();
        setUser(nextUser);
        writeStorage(storageKeys.user, nextUser);
      },
      updateProfile: async (payload) => {
        if (isDevAuthToken(token)) {
          setUser((previous) => {
            const nextUser: User = {
              ...(previous ?? buildDevUser()),
              username: payload.username ?? previous?.username ?? 'dev_new_user',
              profile: {
                ...(previous?.profile ?? {}),
                ...(payload.profile ?? {}),
              },
              updatedAt: new Date().toISOString(),
            };
            writeStorage(storageKeys.user, nextUser);
            return nextUser;
          });
          return;
        }

        const nextUser = await updateCurrentUserApi(payload);
        setUser(nextUser);
        writeStorage(storageKeys.user, nextUser);
      },
    }),
    [isUsingDevAuth, loading, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

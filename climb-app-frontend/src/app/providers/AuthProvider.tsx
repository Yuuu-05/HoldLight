import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { env } from '../config/env';
import { loginApi, logoutApi, registerApi } from '../../shared/api/auth.api';
import { getCurrentUserApi, updateCurrentUserApi, updateUserPreferencesApi } from '../../shared/api/users.api';
import { removeStorage, storageKeys, writeStorage, readStorage } from '../../shared/lib/storage';
import type { LoginPayload, RegisterPayload } from '../../shared/types/auth';
import type { User, UserProfile } from '../../shared/types/user';
import type { RoleValue } from '../../shared/constants/roles';
import type { UserPreferences, UserPreferencesUpdate } from '../../shared/types/preferences';

interface AuthContextState {
  user: User | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  isProfileComplete: boolean;
  isUsingDevAuth: boolean;
  isDevAuthBypassAvailable: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  loginAsDevUser: (role?: RoleValue) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (payload: { username?: string; profile?: UserProfile }) => Promise<void>;
  updatePreferences: (payload: UserPreferencesUpdate) => Promise<void>;
}

const AuthContext = createContext<AuthContextState | null>(null);

const DEV_TOKEN_PREFIX = 'dev-auth-token:';

interface OnboardingOverrideState {
  userKey: string;
  completed: boolean;
  completedAt: string;
}

function getUserKey(user: User | null | undefined) {
  return user?._id || user?.id || user?.email || user?.username || '';
}

function hasOnboardingOverride(user: User | null) {
  if (!user) return false;
  const override = readStorage<OnboardingOverrideState | null>(storageKeys.onboardingOverride, null);
  return Boolean(override?.completed && override.userKey === getUserKey(user));
}

function persistOnboardingOverride(user: User | null | undefined) {
  const userKey = getUserKey(user);
  if (!userKey) return;

  writeStorage(storageKeys.onboardingOverride, {
    userKey,
    completed: true,
    completedAt: new Date().toISOString(),
  } satisfies OnboardingOverrideState);
}

function checkProfileComplete(user: User | null) {
  return Boolean(user?.username?.trim());
}

function checkOnboarded(user: User | null) {
  if (!user) return false;
  if (user.preferences?.onboarding?.completed) {
    return true;
  }
  if (hasOnboardingOverride(user)) {
    return true;
  }
  return true;
}

function buildDefaultPreferences(role: RoleValue = 'new_user', completed = false): UserPreferences {
  const accessibilityPreset =
    role === 'visually_impaired'
      ? {
          highContrast: true,
          largeText: true,
          simplifiedMode: true,
          voiceCommandsEnabled: true,
          fontScale: 1.2,
        }
      : {};

  return {
    language: 'en',
    accessibility: {
      speechEnabled: true,
      feedbackEnabled: true,
      highContrast: false,
      largeText: false,
      simplifiedMode: false,
      voiceCommandsEnabled: false,
      speechRate: 1,
      speechVolume: 1,
      fontScale: 1,
      fontWeightScale: 0,
      readabilitySpacingScale: 0,
      selectionHighlightIntensity: 0,
      pressFeedbackIntensity: 0,
      boldText: false,
      readabilitySpacing: false,
      strongSelectionHighlight: false,
      alwaysShowTextLabels: false,
      largerTouchTargets: false,
      clearPressFeedback: false,
      reduceMotion: false,
      ...accessibilityPreset,
    },
    notifications: {
      readIds: [],
      updatedAt: null,
    },
    onboarding: {
      completed,
      accessibilitySetupCompleted: true,
      guideCompleted: completed,
      completedAt: completed ? new Date().toISOString() : null,
    },
  };
}

function mergePreferences(
  current: UserPreferences | undefined,
  payload: UserPreferencesUpdate,
  role: RoleValue = 'new_user',
) {
  const base = current ?? buildDefaultPreferences(role);
  const nextOnboarding = payload.onboarding
    ? {
        ...base.onboarding,
        ...payload.onboarding,
      }
    : base.onboarding;

  return {
    ...base,
    ...(payload.language ? { language: payload.language } : {}),
    accessibility: payload.accessibility
      ? {
          ...base.accessibility,
          ...payload.accessibility,
        }
      : base.accessibility,
    notifications:
      payload.notifications && Array.isArray(payload.notifications.readIds)
        ? {
            readIds: payload.notifications.readIds,
            updatedAt: payload.notifications.updatedAt ?? new Date().toISOString(),
          }
        : base.notifications,
    onboarding: {
      ...nextOnboarding,
      completedAt:
        nextOnboarding.completed
          ? nextOnboarding.completedAt ?? base.onboarding.completedAt ?? new Date().toISOString()
          : null,
    },
  } satisfies UserPreferences;
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
    profile: {},
    preferences: buildDefaultPreferences(role, true),
  };
}

export default function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(() => readStorage<string | null>(storageKeys.token, null));
  const [user, setUser] = useState<User | null>(() => readStorage<User | null>(storageKeys.user, null));
  const [loading, setLoading] = useState<boolean>(!!token);
  const preferenceMutationVersionRef = useRef(0);
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

    const startedAtVersion = preferenceMutationVersionRef.current;

    getCurrentUserApi()
      .then((currentUser) => {
        if (preferenceMutationVersionRef.current !== startedAtVersion) {
          return;
        }
        setUser(currentUser);
        writeStorage(storageKeys.user, currentUser);
      })
      .catch(() => {
        if (preferenceMutationVersionRef.current !== startedAtVersion) {
          return;
        }
        removeStorage(storageKeys.token);
        removeStorage(storageKeys.user);
        removeStorage(storageKeys.onboardingOverride);
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
      isProfileComplete: checkProfileComplete(user),
      isUsingDevAuth,
      isDevAuthBypassAvailable: env.devAuthBypassAvailable,
      login: async (payload) => {
        const result = await loginApi(payload);
        setToken(result.token);
        setUser(result.user);
        writeStorage(storageKeys.token, result.token);
        writeStorage(storageKeys.user, result.user);
        if (!result.user.preferences?.onboarding?.completed) {
          removeStorage(storageKeys.onboardingOverride);
        }
      },
      register: async (payload) => {
        const result = await registerApi(payload);
        setToken(result.token);
        setUser(result.user);
        writeStorage(storageKeys.token, result.token);
        writeStorage(storageKeys.user, result.user);
        removeStorage(storageKeys.onboardingOverride);
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
        if (nextUser.preferences?.onboarding?.completed) {
          persistOnboardingOverride(nextUser);
        } else {
          removeStorage(storageKeys.onboardingOverride);
        }
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
          removeStorage(storageKeys.onboardingOverride);
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
      updatePreferences: async (payload) => {
        const previousUser = user;
        const optimisticUser: User = {
          ...(previousUser ?? buildDevUser()),
          preferences: mergePreferences(previousUser?.preferences, payload, previousUser?.role ?? 'new_user'),
          updatedAt: new Date().toISOString(),
        };

        preferenceMutationVersionRef.current += 1;
        setUser(optimisticUser);
        writeStorage(storageKeys.user, optimisticUser);

        if (optimisticUser.preferences?.onboarding?.completed) {
          persistOnboardingOverride(optimisticUser);
        }

        if (isDevAuthToken(token)) {
          return;
        }

        try {
          const nextPreferences = await updateUserPreferencesApi(payload);
          setUser((previous) => {
            if (!previous) return previous;
            const nextUser: User = {
              ...previous,
              preferences: nextPreferences,
              updatedAt: new Date().toISOString(),
            };
            writeStorage(storageKeys.user, nextUser);
            if (nextPreferences.onboarding?.completed) {
              persistOnboardingOverride(nextUser);
            }
            return nextUser;
          });
        } catch (_error) {
          // Keep the optimistic local state so the user is never trapped in onboarding
          // because of a slow or stale backend response.
        }
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

export type AppLanguage = 'en' | 'zh';

export interface AccessibilityPreferences {
  speechEnabled: boolean;
  feedbackEnabled: boolean;
  highContrast: boolean;
  largeText: boolean;
  simplifiedMode: boolean;
  voiceCommandsEnabled: boolean;
  speechRate: number;
  speechVolume: number;
  fontScale: number;
}

export interface NotificationPreferences {
  readIds: string[];
  updatedAt?: string | null;
}

export interface OnboardingPreferences {
  completed: boolean;
  accessibilitySetupCompleted: boolean;
  guideCompleted: boolean;
  completedAt?: string | null;
}

export interface UserPreferences {
  language: AppLanguage;
  accessibility: AccessibilityPreferences;
  notifications: NotificationPreferences;
  onboarding: OnboardingPreferences;
}

export interface UserPreferencesUpdate {
  language?: AppLanguage;
  accessibility?: Partial<AccessibilityPreferences>;
  notifications?: Partial<NotificationPreferences>;
  onboarding?: Partial<OnboardingPreferences>;
}

export type AppLanguage = 'en' | 'zh';

export interface AccessibilityPreferences {
  speechEnabled: boolean;
  feedbackEnabled: boolean;
  highContrast: boolean;
  largeText: boolean;
  simplifiedMode: boolean;
  voiceCommandsEnabled: boolean;
  speechRate: number;
  fontScale: number;
}

export interface TutorialProgressPreferences {
  completedIds: string[];
  updatedAt?: string | null;
}

export interface NotificationPreferences {
  readIds: string[];
  updatedAt?: string | null;
}

export interface UserPreferences {
  language: AppLanguage;
  accessibility: AccessibilityPreferences;
  tutorialProgress: TutorialProgressPreferences;
  notifications: NotificationPreferences;
}

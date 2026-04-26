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
  fontWeightScale: number;
  readabilitySpacingScale: number;
  selectionHighlightIntensity: number;
  pressFeedbackIntensity: number;
  boldText: boolean;
  readabilitySpacing: boolean;
  strongSelectionHighlight: boolean;
  alwaysShowTextLabels: boolean;
  largerTouchTargets: boolean;
  clearPressFeedback: boolean;
  reduceMotion: boolean;
}

export type SyncedAccessibilityPreferences = Pick<
  AccessibilityPreferences,
  | 'speechEnabled'
  | 'feedbackEnabled'
  | 'highContrast'
  | 'largeText'
  | 'simplifiedMode'
  | 'voiceCommandsEnabled'
  | 'speechRate'
  | 'speechVolume'
  | 'fontScale'
>;

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

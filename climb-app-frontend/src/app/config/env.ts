export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:5000/api',
  appName: 'Climb Together',
  appTagline: 'Accessible climbing guidance for visually impaired climbers.',
  storagePrefix: 'climb-app',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  studyModeEnabledByDefault: ['1', 'true', 'yes', 'on'].includes(
    String(import.meta.env.VITE_STUDY_MODE ?? import.meta.env.VITE_RESEARCH_MODE ?? '').trim().toLowerCase(),
  ),
  devAuthBypassAvailable: Boolean(
    import.meta.env.DEV &&
    !import.meta.env.PROD &&
    import.meta.env.VITE_ENABLE_DEV_AUTH_BYPASS !== 'false'
  ),
};

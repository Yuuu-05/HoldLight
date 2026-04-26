const fallbackApiBaseUrl = import.meta.env.PROD ? '/api' : 'http://localhost:5001/api';

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL?.trim() || fallbackApiBaseUrl,
  appName: 'HoldLight',
  appTagline: 'Accessible climbing guidance for visually impaired climbers.',
  storagePrefix: 'climb-app',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  devAuthBypassAvailable: Boolean(
    import.meta.env.DEV &&
    !import.meta.env.PROD &&
    import.meta.env.VITE_ENABLE_DEV_AUTH_BYPASS !== 'false'
  ),
};

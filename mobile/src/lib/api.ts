import axios from 'axios';
import Constants from 'expo-constants';

const FALLBACK_URL = 'http://localhost:4000/api';

/**
 * The dev machine's LAN IP changes any time Wi-Fi reconnects or a DHCP lease renews,
 * which silently breaks a hardcoded EXPO_PUBLIC_API_URL. Expo already knows the exact
 * host the phone just used to load the JS bundle (hostUri) — reusing that host, with
 * the port/path from .env, means the API URL is always correct without manual edits.
 * Falls back to EXPO_PUBLIC_API_URL untouched for production builds (no dev host).
 */
const resolveApiBaseUrl = () => {
  const envUrl = process.env.EXPO_PUBLIC_API_URL || FALLBACK_URL;
  const hostUri = (Constants.expoConfig as any)?.hostUri || (Constants as any)?.expoGoConfig?.debuggerHost;
  const host = hostUri ? String(hostUri).split(':')[0] : null;
  if (!host || host === 'localhost' || host === '127.0.0.1') return envUrl;

  try {
    const parsed = new URL(envUrl);
    return `${parsed.protocol}//${host}:${parsed.port || '4000'}${parsed.pathname}`;
  } catch {
    return `http://${host}:4000/api`;
  }
};

const api = axios.create({
  baseURL: resolveApiBaseUrl()
});

let unauthorizedHandler: (() => void) | null = null;

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

export default api;

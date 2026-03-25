import axios from 'axios';
import { notifyDataChanged } from './dataSync';
import { appStorage } from './appStorage';
import {
  cacheGetResponse,
  getCachedResponse,
  initializeOfflineSync,
  isNetworkFailure,
  isSyncUnavailable,
  makeQueuedResponse,
  queueOfflineMutation,
  shouldQueueMutation
} from './offlineSync';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api'
});

api.interceptors.request.use((config) => {
  const token = appStorage.getItem('rentdesk_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use((response) => {
  const method = String(response.config.method || '').toLowerCase();
  if (method === 'get') {
    cacheGetResponse(response.config, response.data);
  }
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    notifyDataChanged();
  }
  return response;
}, (error) => {
  const status = error?.response?.status;
  const requestUrl = String(error?.config?.url || '');
  const isAuthRoute = requestUrl.startsWith('/auth/');
  const config = error?.config || {};

  if (status === 401 && !isAuthRoute) {
    appStorage.removeItem('rentdesk_token');
    appStorage.removeItem('rentdesk_active_portfolio_id');
    if (window.location.pathname !== '/login') {
      window.location.replace('/login');
    }
  }

  if (isSyncUnavailable(error)) {
    const method = String(config.method || '').toLowerCase();
    if (method === 'get') {
      const cachedData = getCachedResponse(config);
      if (cachedData !== undefined) {
        return Promise.resolve({
          data: cachedData,
          status: 200,
          statusText: 'OK (cached)',
          headers: {},
          config
        });
      }
    }

    if (shouldQueueMutation(config)) {
      queueOfflineMutation(config);
      notifyDataChanged();
      return Promise.resolve(makeQueuedResponse(config));
    }
  }

  return Promise.reject(error);
});

initializeOfflineSync(api);

export default api;

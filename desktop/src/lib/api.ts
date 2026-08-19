import axios from 'axios';
import { appStorage } from './appStorage';

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url || '');
    const isAuthRoute = requestUrl.startsWith('/auth/');

    if (status === 401 && !isAuthRoute) {
      appStorage.removeItem('rentdesk_token');
      appStorage.removeItem('rentdesk_active_portfolio_id');
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

export default api;

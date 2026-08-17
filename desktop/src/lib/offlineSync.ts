import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { useSyncExternalStore } from 'react';
import { notifyDataChanged } from './dataSync';
import { appStorage } from './appStorage';

type QueuedRequest = {
  id: string;
  method: string;
  url: string;
  params?: any;
  data?: any;
  headers?: Record<string, string>;
  createdAt: string;
};

type SyncState = {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
};

const QUEUE_STORAGE_KEY = 'rentdesk_offline_queue_v1';
const CACHE_STORAGE_KEY = 'rentdesk_http_cache_v1';

const listeners = new Set<() => void>();
let syncState: SyncState = {
  isOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: null
};
let initialized = false;

const emit = () => listeners.forEach((listener) => listener());

const setSyncState = (patch: Partial<SyncState>) => {
  syncState = { ...syncState, ...patch };
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => syncState;

export const useSyncStatus = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const getQueue = () => safeParse<QueuedRequest[]>(appStorage.getItem(QUEUE_STORAGE_KEY), []);

const setQueue = (queue: QueuedRequest[]) => {
  appStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  setSyncState({ pendingCount: queue.length });
};

const getCacheMap = () => safeParse<Record<string, any>>(appStorage.getItem(CACHE_STORAGE_KEY), {});

const setCacheMap = (cache: Record<string, any>) => {
  appStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
};

const getSessionToken = () => appStorage.getItem('rentdesk_token') || 'guest';

const getNormalizedRequest = (config: AxiosRequestConfig) => {
  const rawUrl = String(config.url || '');
  const [pathname, queryString = ''] = rawUrl.split('?');
  const searchParams = new URLSearchParams(queryString);
  const mergedParams: Record<string, string> = {};

  searchParams.forEach((value, key) => {
    mergedParams[key] = value;
  });

  if (config.params && typeof config.params === 'object') {
    Object.entries(config.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        mergedParams[key] = String(value);
      }
    });
  }

  const sortedParamEntries = Object.entries(mergedParams).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  return {
    pathname,
    params: Object.fromEntries(sortedParamEntries)
  };
};

const makeCacheKey = (config: AxiosRequestConfig) => {
  const { pathname, params } = getNormalizedRequest(config);
  const paramsKey = Object.keys(params).length ? JSON.stringify(params) : '';
  const activePortfolioId = appStorage.getItem('rentdesk_active_portfolio_id') || 'no-portfolio';
  return `${getSessionToken()}::${activePortfolioId}::${pathname}::${paramsKey}`;
};

const parseData = (value: any) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const cacheGetResponse = (config: AxiosRequestConfig, data: any) => {
  const cache = getCacheMap();
  cache[makeCacheKey(config)] = {
    data,
    updatedAt: new Date().toISOString()
  };
  setCacheMap(cache);
};

export const getCachedResponse = (config: AxiosRequestConfig) => {
  const cache = getCacheMap();
  const exact = cache[makeCacheKey(config)]?.data;
  if (exact !== undefined) return exact;

  const { pathname, params } = getNormalizedRequest(config);
  const buildBaseConfig = (url: string) => ({ ...config, url, params: {} });
  const getBaseData = (url: string) => cache[makeCacheKey(buildBaseConfig(url))]?.data;

  if (/\/properties\/[^/]+\/rent-records$/.test(pathname)) {
    const records = getBaseData(pathname);
    if (!Array.isArray(records)) return undefined;
    return records.filter((record: any) => {
      const monthMatch = !params.month || String(record.month) === String(params.month);
      const yearMatch = !params.year || String(record.year) === String(params.year);
      const statusList = params.status
        ? String(params.status)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [];
      const statusMatch = !statusList.length || statusList.includes(String(record.status));
      return monthMatch && yearMatch && statusMatch;
    });
  }

  if (/\/properties\/[^/]+\/utility-bills$/.test(pathname)) {
    const bills = getBaseData(pathname);
    if (!Array.isArray(bills)) return undefined;
    return bills.filter((bill: any) => {
      const billTypeMatch = !params.billType || String(bill.billType) === String(params.billType);
      const monthMatch = !params.month || String(bill.month) === String(params.month);
      const statusList = params.status
        ? String(params.status)
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [];
      const statusMatch = !statusList.length || statusList.includes(String(bill.status));
      return billTypeMatch && monthMatch && statusMatch;
    });
  }

  if (/\/properties\/[^/]+\/payments$/.test(pathname)) {
    const payments = getBaseData(pathname);
    if (!Array.isArray(payments)) return undefined;
    return payments.filter((payment: any) => {
      const typeMatch = !params.type || String(payment.type) === String(params.type);
      const paymentDate = new Date(payment.date).getTime();
      const startMatch = !params.startDate || paymentDate >= new Date(String(params.startDate)).getTime();
      const endMatch = !params.endDate || paymentDate <= new Date(String(params.endDate)).getTime();
      return typeMatch && startMatch && endMatch;
    });
  }

  if (/\/properties\/[^/]+\/units$/.test(pathname)) {
    const units = getBaseData(pathname);
    if (!Array.isArray(units)) return undefined;
    if (!('archived' in params)) return units;
    const wantArchived = String(params.archived) === 'true';
    return units.filter((unit: any) => Boolean(unit.isArchived) === wantArchived);
  }

  if (/\/properties\/[^/]+\/maintenance$/.test(pathname)) {
    const records = getBaseData(pathname);
    if (!Array.isArray(records)) return undefined;
    return records;
  }

  if (/\/properties\/[^/]+\/tenants$/.test(pathname)) {
    const tenants = getBaseData(pathname);
    if (!Array.isArray(tenants)) return undefined;
    if (!params.status) return tenants;
    return tenants.filter((tenant: any) => {
      if (params.status === 'active') return tenant.isActive;
      if (params.status === 'deleted') return !tenant.isActive;
      return true;
    });
  }

  return undefined;
};

export const invalidateOfflineCache = () => {
  setCacheMap({});
};

export const queueOfflineMutation = (config: AxiosRequestConfig) => {
  const queue = getQueue();
  queue.push({
    id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    method: String(config.method || 'post').toLowerCase(),
    url: String(config.url || ''),
    params: config.params,
    data: parseData(config.data),
    headers: config.headers ? Object.fromEntries(Object.entries(config.headers as Record<string, any>).map(([key, value]) => [key, String(value)])) : undefined,
    createdAt: new Date().toISOString()
  });
  setQueue(queue);
};

const isReplayRequest = (config: AxiosRequestConfig) =>
  String((config.headers as Record<string, any> | undefined)?.['x-rentdesk-offline-replay'] || '') === '1';

export const isNetworkFailure = (error: any) =>
  !error?.response && (
    error?.code === 'ERR_NETWORK' ||
    error?.message === 'Network Error' ||
    /network/i.test(String(error?.message || ''))
  );

export const isSyncUnavailable = (error: any) =>
  isNetworkFailure(error) || Number(error?.response?.status || 0) >= 500;

export const makeQueuedResponse = (config: AxiosRequestConfig) => ({
  data: {
    queued: true,
    offline: true,
    ...(typeof parseData(config.data) === 'object' ? parseData(config.data) : {})
  },
  status: 202,
  statusText: 'Queued Offline',
  headers: {},
  config
});

export const initializeOfflineSync = (api: AxiosInstance) => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  setSyncState({ pendingCount: getQueue().length, isOnline: navigator.onLine });

  const flushQueue = async () => {
    if (syncState.isSyncing || !navigator.onLine) {
      return;
    }
    const queue = getQueue();
    if (!queue.length) {
      setSyncState({ pendingCount: 0, isOnline: navigator.onLine });
      return;
    }

    setSyncState({ isSyncing: true, isOnline: true });
    let workingQueue = [...queue];

    while (workingQueue.length) {
      const next = workingQueue[0];
      try {
        await api.request({
          url: next.url,
          method: next.method as any,
          params: next.params,
          data: next.data,
          headers: {
            ...(next.headers || {}),
            'x-rentdesk-offline-replay': '1'
          }
        });
        workingQueue.shift();
        setQueue(workingQueue);
        notifyDataChanged();
      } catch (error: any) {
        if (isSyncUnavailable(error)) {
          setSyncState({ isOnline: false });
          break;
        }
        workingQueue.shift();
        setQueue(workingQueue);
      }
    }

    setSyncState({
      isSyncing: false,
      isOnline: navigator.onLine,
      lastSyncedAt: navigator.onLine ? new Date().toISOString() : syncState.lastSyncedAt
    });
  };

  window.addEventListener('online', () => {
    setSyncState({ isOnline: true });
    void flushQueue();
  });
  window.addEventListener('offline', () => {
    setSyncState({ isOnline: false });
  });

  window.setInterval(() => {
    void flushQueue();
  }, 15000);
};

export const shouldQueueMutation = (config: AxiosRequestConfig) => {
  const method = String(config.method || '').toLowerCase();
  const url = String(config.url || '');
  return ['post', 'put', 'patch', 'delete'].includes(method) &&
    !url.startsWith('/auth/') &&
    !isReplayRequest(config);
};

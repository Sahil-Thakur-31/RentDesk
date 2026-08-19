import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import api from './api';

type UrlTags = {
  resource: string;
  propertyId?: string;
  monthKey?: string;
};

type CacheEntry = {
  data: any;
  updatedAt: number;
  tags: string[];
  url: string;
  params?: Record<string, any>;
};

const cache = new Map<string, CacheEntry>();
const tagIndex = new Map<string, Set<string>>();
const keyListeners = new Map<string, Set<() => void>>();
const inFlight = new Map<string, Promise<any>>();

const buildCacheKey = (url: string, params?: Record<string, any>) => {
  const entries = params
    ? Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    : [];
  if (!entries.length) return url;
  const sorted = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return `${url}?${sorted}`;
};

export const classifyUrl = (url: string, params?: Record<string, any>): UrlTags | null => {
  const path = url.split('?')[0];
  let match: RegExpMatchArray | null;

  if ((match = path.match(/^\/properties\/([^/]+)\/units\/([^/]+)\/details$/))) {
    return { resource: 'unitDetails', propertyId: match[1] };
  }
  if ((match = path.match(/^\/properties\/([^/]+)\/units\/([^/]+)$/))) {
    return { resource: 'unit', propertyId: match[1] };
  }
  if ((match = path.match(/^\/properties\/([^/]+)\/units$/))) {
    return { resource: 'unit', propertyId: match[1] };
  }
  if ((match = path.match(/^\/properties\/([^/]+)\/tenants\/([^/]+)\/details$/))) {
    return { resource: 'tenantDetails', propertyId: match[1] };
  }
  if ((match = path.match(/^\/properties\/([^/]+)\/tenants\/([^/]+)$/))) {
    return { resource: 'tenant', propertyId: match[1] };
  }
  if ((match = path.match(/^\/properties\/([^/]+)\/tenants$/))) {
    return { resource: 'tenant', propertyId: match[1] };
  }
  if ((match = path.match(/^\/properties\/([^/]+)\/rent-records$/))) {
    const monthKey = params?.month && params?.year ? `${params.year}-${String(params.month).padStart(2, '0')}` : undefined;
    return { resource: 'rentRecord', propertyId: match[1], monthKey };
  }
  if ((match = path.match(/^\/properties\/([^/]+)\/utility-bills\/electricity-readings$/))) {
    return { resource: 'utilityBill', propertyId: match[1], monthKey: params?.month ? String(params.month) : undefined };
  }
  if ((match = path.match(/^\/properties\/([^/]+)\/utility-bills$/))) {
    return { resource: 'utilityBill', propertyId: match[1], monthKey: params?.month ? String(params.month) : undefined };
  }
  if ((match = path.match(/^\/properties\/([^/]+)\/maintenance$/))) {
    return { resource: 'maintenance', propertyId: match[1], monthKey: params?.month ? String(params.month) : undefined };
  }
  if ((match = path.match(/^\/properties\/([^/]+)\/payments$/))) {
    return { resource: 'payment', propertyId: match[1] };
  }
  if ((match = path.match(/^\/properties\/([^/]+)\/overview$/))) {
    return { resource: 'propertyOverview', propertyId: match[1] };
  }
  if ((match = path.match(/^\/properties\/([^/]+)$/))) {
    return { resource: 'property', propertyId: match[1] };
  }
  if (path === '/properties') {
    return { resource: 'property' };
  }
  if (path === '/dashboard') {
    return {
      resource: 'dashboard',
      propertyId: params?.propertyId ? String(params.propertyId) : undefined,
      monthKey: params?.month && params?.year ? `${params.year}-${String(params.month).padStart(2, '0')}` : undefined
    };
  }
  if (path === '/portfolio' || path === '/portfolio/list') {
    return { resource: 'portfolio' };
  }
  if (path === '/users') {
    return { resource: 'user' };
  }

  return null;
};

const tagsFor = (classification: UrlTags | null): string[] => {
  if (!classification) return [];
  const coarse = `${classification.resource}::${classification.propertyId || '*'}`;
  const tags = [coarse];
  if (classification.monthKey) {
    tags.push(`${coarse}::${classification.monthKey}`);
  }
  return tags;
};

const registerTags = (cacheKey: string, tags: string[]) => {
  tags.forEach((tag) => {
    let set = tagIndex.get(tag);
    if (!set) {
      set = new Set();
      tagIndex.set(tag, set);
    }
    set.add(cacheKey);
  });
};

const unregisterTags = (cacheKey: string, tags: string[]) => {
  tags.forEach((tag) => {
    const set = tagIndex.get(tag);
    if (!set) return;
    set.delete(cacheKey);
    if (!set.size) tagIndex.delete(tag);
  });
};

const notifyKey = (cacheKey: string) => {
  keyListeners.get(cacheKey)?.forEach((listener) => listener());
};

const writeCache = (cacheKey: string, url: string, params: Record<string, any> | undefined, data: any) => {
  const previous = cache.get(cacheKey);
  if (previous) unregisterTags(cacheKey, previous.tags);
  const tags = tagsFor(classifyUrl(url, params));
  cache.set(cacheKey, { data, updatedAt: Date.now(), tags, url, params });
  registerTags(cacheKey, tags);
  notifyKey(cacheKey);
};

const deleteCache = (cacheKey: string) => {
  const entry = cache.get(cacheKey);
  if (!entry) return;
  unregisterTags(cacheKey, entry.tags);
  cache.delete(cacheKey);
  notifyKey(cacheKey);
};

export const primeCache = (url: string, params: Record<string, any> | undefined, data: any) => {
  writeCache(buildCacheKey(url, params), url, params, data);
};

const fetchAndCache = async (url: string, params?: Record<string, any>) => {
  const cacheKey = buildCacheKey(url, params);
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const promise = api
    .get(url, { params })
    .then((response) => {
      writeCache(cacheKey, url, params, response.data);
      inFlight.delete(cacheKey);
      return response.data;
    })
    .catch((error) => {
      inFlight.delete(cacheKey);
      throw error;
    });

  inFlight.set(cacheKey, promise);
  return promise;
};

export const isCached = (url: string, params?: Record<string, any>) => cache.has(buildCacheKey(url, params));

export const cachedGet = async (url: string, params?: Record<string, any>): Promise<any> => {
  const cacheKey = buildCacheKey(url, params);
  const cached = cache.get(cacheKey);
  if (cached) return cached.data;
  return fetchAndCache(url, params);
};

export const invalidateByTag = (resource: string, propertyId?: string, monthKey?: string) => {
  const coarse = `${resource}::${propertyId || '*'}`;
  const tag = monthKey ? `${coarse}::${monthKey}` : coarse;
  const keys = tagIndex.get(tag);
  if (!keys || !keys.size) return;

  Array.from(keys).forEach((cacheKey) => {
    const entry = cache.get(cacheKey);
    if (!entry) return;
    const hasLiveListener = (keyListeners.get(cacheKey)?.size || 0) > 0;
    if (hasLiveListener) {
      fetchAndCache(entry.url, entry.params).catch(() => {});
    } else {
      deleteCache(cacheKey);
    }
  });
};

export const invalidateAll = () => {
  const keys = Array.from(cache.keys());
  cache.clear();
  tagIndex.clear();
  inFlight.clear();
  keys.forEach((cacheKey) => notifyKey(cacheKey));
};

export const useCachedQuery = <T = any>(url: string | null, params?: Record<string, any>) => {
  const cacheKey = url ? buildCacheKey(url, params) : null;
  const paramsKey = params ? JSON.stringify(params) : '';

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!cacheKey) return () => {};
      let set = keyListeners.get(cacheKey);
      if (!set) {
        set = new Set();
        keyListeners.set(cacheKey, set);
      }
      set.add(listener);
      return () => {
        set?.delete(listener);
        if (set && !set.size) keyListeners.delete(cacheKey);
      };
    },
    [cacheKey]
  );

  const getSnapshot = useCallback(() => (cacheKey ? cache.get(cacheKey)?.data : undefined), [cacheKey]);
  const data: T | undefined = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const [loading, setLoading] = useState(() => Boolean(cacheKey) && !(cacheKey && cache.has(cacheKey)));
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!url || !cacheKey) {
      setLoading(false);
      return;
    }
    if (cache.has(cacheKey)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAndCache(url, params)
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, cacheKey, paramsKey]);

  const refetch = useCallback(async () => {
    if (!url) return;
    setError(null);
    try {
      await fetchAndCache(url, params);
    } catch (err) {
      setError(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, paramsKey]);

  return { data, loading, error, refetch };
};

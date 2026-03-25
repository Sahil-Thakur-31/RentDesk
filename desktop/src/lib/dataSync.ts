import { useSyncExternalStore } from 'react';

let dataVersion = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => dataVersion;

export const notifyDataChanged = () => {
  dataVersion += 1;
  listeners.forEach((listener) => listener());
};

export const useDataVersion = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

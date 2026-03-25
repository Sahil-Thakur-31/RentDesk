const fallbackStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key)
};

export const appStorage = {
  getItem(key: string) {
    return window.rentdesk?.storage?.getItem(key) ?? fallbackStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (window.rentdesk?.storage) {
      window.rentdesk.storage.setItem(key, value);
      return;
    }
    fallbackStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (window.rentdesk?.storage) {
      window.rentdesk.storage.removeItem(key);
      return;
    }
    fallbackStorage.removeItem(key);
  }
};

declare global {
  interface Window {
    rentdesk?: {
      platform?: string;
      storage?: {
        getItem(key: string): string | null;
        setItem(key: string, value: string): void;
        removeItem(key: string): void;
      };
    };
  }
}


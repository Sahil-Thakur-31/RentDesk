import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { useAuth } from './AuthContext';

type PortfolioContextValue = {
  me: any;
  portfolio: any;
  membership: any;
  properties: any[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const PortfolioContext = createContext<PortfolioContextValue>({
  me: null,
  portfolio: null,
  membership: null,
  properties: [],
  loading: false,
  refresh: async () => {}
});

export const PortfolioProvider = ({ children }: { children: React.ReactNode }) => {
  const { token, ready } = useAuth();
  const [me, setMe] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!token) {
      setMe(null);
      setPortfolio(null);
      setMembership(null);
      setProperties([]);
      return;
    }

    setLoading(true);
    try {
      const [meRes, portfolioRes] = await Promise.all([api.get('/auth/me'), api.get('/portfolio')]);
      setMe(meRes.data?.user || null);
      setPortfolio(portfolioRes.data?.portfolio || null);
      setMembership(portfolioRes.data?.membership || null);
      setProperties(portfolioRes.data?.properties || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, token]);

  const value = useMemo(
    () => ({ me, portfolio, membership, properties, loading, refresh }),
    [loading, me, membership, portfolio, properties]
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
};

export const usePortfolio = () => useContext(PortfolioContext);


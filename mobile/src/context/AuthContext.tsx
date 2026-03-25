import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { setAuthToken, setUnauthorizedHandler } from '../lib/api';

type AuthContextValue = {
  token: string | null;
  ready: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  token: null,
  ready: false,
  signIn: async () => {},
  signOut: async () => {}
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const signOut = async () => {
    setToken(null);
    setAuthToken(null);
    await AsyncStorage.removeItem('rentdesk_token');
  };

  useEffect(() => {
    const loadToken = async () => {
      const stored = await AsyncStorage.getItem('rentdesk_token');
      if (stored) {
        setAuthToken(stored);
        try {
          await api.get('/auth/me');
          setToken(stored);
        } catch (error: any) {
          if (error?.response?.status === 401) {
            await AsyncStorage.removeItem('rentdesk_token');
            setAuthToken(null);
            setToken(null);
          } else {
            // Keep the session when the backend is temporarily unreachable.
            setToken(stored);
          }
        }
      }
      setReady(true);
    };

    void loadToken();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void signOut();
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      ready,
      signIn: async (nextToken: string) => {
        setToken(nextToken);
        setAuthToken(nextToken);
        await AsyncStorage.setItem('rentdesk_token', nextToken);
      },
      signOut
    }),
    [ready, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export const useAuthorizedApi = () => api;


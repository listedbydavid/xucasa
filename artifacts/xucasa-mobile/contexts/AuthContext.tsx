import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiGet, apiPost, clearSession, storeSessionToken, type User } from '@/lib/api';
import { retryPendingPushUnregistration, unregisterPushDevice } from '@/lib/pushNotifications';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthSessionResponse {
  user: User;
  sessionToken?: string;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const userData = await apiGet<User>('/api/auth/user');
      setUser(userData);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    retryPendingPushUnregistration().catch(() => undefined);
    refreshUser().finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await apiPost<AuthSessionResponse>('/api/auth/login', { email, password });
    await storeSessionToken(session.sessionToken);
    const userData = await apiGet<User>('/api/auth/user');
    setUser(userData);
  }, []);

  const register = useCallback(async (email: string, password: string, firstName: string, lastName = '') => {
    const session = await apiPost<AuthSessionResponse>('/api/auth/register', { email, password, firstName, lastName });
    await storeSessionToken(session.sessionToken);
    const userData = await apiGet<User>('/api/auth/user');
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try { await unregisterPushDevice(); } catch {}
    try { await apiGet('/api/logout'); } catch {}
    await clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

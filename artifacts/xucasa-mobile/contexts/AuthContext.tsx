import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiGet, apiPost, clearSession, type User } from '@/lib/api';

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
    refreshUser().finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    await apiPost('/api/auth/login', { email, password });
    await refreshUser();
  }, [refreshUser]);

  const register = useCallback(async (email: string, password: string, firstName: string, lastName = '') => {
    await apiPost('/api/auth/register', { email, password, firstName, lastName });
    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
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

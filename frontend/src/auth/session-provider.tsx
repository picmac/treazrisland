'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { SessionPayload, SessionUser, LoginResponse } from "@/src/lib/api/auth";
import { login as apiLogin, logout as apiLogout, refreshSession } from "@/src/lib/api/auth";

type AuthContextValue = {
  user: SessionUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (payload: {
    identifier: string;
    password: string;
    mfaCode?: string;
    recoveryCode?: string;
  }) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  refresh: () => Promise<SessionPayload>;
  setSession: (payload: SessionPayload) => void;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<SessionPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const hasRefreshed = useRef(false);

  const applySession = useCallback((payload: SessionPayload) => {
    setSessionState(payload);
  }, []);

  const clearSession = useCallback(() => {
    setSessionState(null);
  }, []);

  const refresh = useCallback(async () => {
    const payload = await refreshSession();
    applySession(payload);
    return payload;
  }, [applySession]);

  const login = useCallback<AuthContextValue["login"]>(
    async (payload) => {
      const response = await apiLogin(payload);
      applySession(response);
      return response;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    if (hasRefreshed.current) {
      return;
    }
    hasRefreshed.current = true;

    refresh()
      .catch(() => {
        clearSession();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [clearSession, refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      loading,
      login,
      logout,
      refresh,
      setSession: applySession,
      clearSession
    }),
    [applySession, clearSession, loading, login, logout, refresh, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useSession must be used within an AuthProvider");
  }
  return context;
}

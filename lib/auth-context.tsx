"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api, apiPublic, setOnAuthFailure, tokenStorage } from "@/lib/api";

export type AuthUser = {
  id: number;
  email: string;
  company_id: number | null;
  roles: string[];
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: string) => boolean;
  isSuperadmin: boolean;
  isAdminOrSuperadmin: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAndRedirect = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    router.replace("/admin/login");
  }, [router]);

  useEffect(() => {
    setOnAuthFailure(clearAndRedirect);
  }, [clearAndRedirect]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const access = tokenStorage.getAccess();
      if (!access) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get<AuthUser>("/auth/me");
        if (!cancelled) setUser(res.data);
      } catch {
        tokenStorage.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiPublic.post("/auth/login", { email, password });
    const { access_token: access, refresh_token: refresh, user: loggedUser } = res.data ?? {};
    if (!access || !refresh || !loggedUser) {
      throw new Error("Resposta de login inválida");
    }
    tokenStorage.setTokens(access, refresh);
    setUser(loggedUser);
  }, []);

  const logout = useCallback(async () => {
    const refresh = tokenStorage.getRefresh();
    try {
      if (refresh) await api.post("/auth/logout", { refresh_token: refresh });
    } catch {
      // Ignora erros de logout - vamos limpar o estado local mesmo assim.
    }
    clearAndRedirect();
  }, [clearAndRedirect]);

  const value = useMemo<AuthContextValue>(() => {
    const hasRole = (role: string) => !!user && user.roles.includes(role);
    return {
      user,
      loading,
      login,
      logout,
      hasRole,
      isSuperadmin: hasRole("superadmin"),
      isAdminOrSuperadmin: hasRole("admin") || hasRole("superadmin"),
    };
  }, [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

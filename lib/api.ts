import axios, { AxiosError } from "axios";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export const apiPublic = axios.create({ baseURL: API_BASE_URL });

const ACCESS_KEY = "chazz.accessToken";
const REFRESH_KEY = "chazz.refreshToken";

export const tokenStorage = {
  getAccess(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(ACCESS_KEY);
  },
  getRefresh(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(REFRESH_KEY);
  },
  setTokens(access: string, refresh: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACCESS_KEY, access);
    window.localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  },
};

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const access = tokenStorage.getAccess();
  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;
let onAuthFailureHandler: (() => void) | null = null;

export function setOnAuthFailure(handler: () => void) {
  onAuthFailureHandler = handler;
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefresh();
  if (!refreshToken) return null;
  try {
    const res = await apiPublic.post("/auth/refresh", { refresh_token: refreshToken });
    const { access_token: access, refresh_token: refresh } = res.data ?? {};
    if (!access || !refresh) return null;
    tokenStorage.setTokens(access, refresh);
    return access;
  } catch {
    tokenStorage.clear();
    if (onAuthFailureHandler) onAuthFailureHandler();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    if (!original || error.response?.status !== 401 || original._retried) {
      return Promise.reject(error);
    }
    original._retried = true;
    if (!refreshing) refreshing = performRefresh();
    const newAccess = await refreshing;
    refreshing = null;
    if (!newAccess) {
      return Promise.reject(error);
    }
    original.headers = original.headers ?? {};
    (original.headers as Record<string, string>).Authorization = `Bearer ${newAccess}`;
    return api.request(original);
  },
);

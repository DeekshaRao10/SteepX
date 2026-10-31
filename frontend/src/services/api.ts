import axios from "axios";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
const TOKEN_KEY = "steepx_session_token";
const EXPIRY_KEY = "steepx_session_expires";
export const SESSION_EVENT = "steepx:session-ended";

// The API validates the server-side session on every request and revokes it on logout.
// Tokens are scoped to this browser tab and are never put in URLs or logs.
export const session = {
  token: () => typeof window === "undefined" ? null : sessionStorage.getItem(TOKEN_KEY),
  expiresAt: () => typeof window === "undefined" ? 0 : Number(sessionStorage.getItem(EXPIRY_KEY)),
  save(token: string, expiresIn: number) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
  },
  clear() {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRY_KEY);
    window.dispatchEvent(new Event(SESSION_EVENT));
  },
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "ApiError";
  }
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request could not be completed.";
}
export const apiClient = axios.create({
  baseURL: API_BASE_URL, timeout: 15000,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});
apiClient.interceptors.request.use(config => {
  const token = session.token();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
apiClient.interceptors.response.use(response => response, error => {
  const status = error.response?.status || 0;
  const body = error.response?.data?.error;
  const details = body?.details?.map((detail: { location: (string | number)[]; message: string }) =>
    `${detail.location.filter(part => part !== "body").join(".")}: ${detail.message}`).join(" ");
  if (status === 401 && error.config?.url !== "/auth/login") session.clear();
  return Promise.reject(new ApiError(details || body?.message || (status
    ? "The server could not complete this request."
    : "Cannot reach the API. Check that the backend is running and try again."), status, body?.code));
});
export interface Page<T> { items: T[]; total: number; limit: number; offset: number }
export async function listAll<T>(path: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const items: T[] = [];
  let offset = 0;
  while (true) {
    const { data } = await apiClient.get<Page<T>>(path, { params: { ...params, limit: 100, offset } });
    items.push(...data.items);
    offset += data.items.length;
    if (!data.items.length || offset >= data.total) return items;
  }
}
export function utcDate() { return new Date().toISOString().slice(0, 10); }

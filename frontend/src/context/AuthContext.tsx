"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, UserRole } from "@/types";
import { authService, LoginCredentials, Registration } from "@/services/auth.service";
import { session, SESSION_EVENT, ApiError, errorMessage } from "@/services/api";
import { useToast } from "./ToastContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface AuthContextType {
  user: User | null; role: UserRole; isLoading: boolean;
  isAdmin: boolean; isStaff: boolean; isCustomer: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: Registration) => Promise<void>;
  logout: () => Promise<void>;
  canAccess: (roles: UserRole[]) => boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
const publicPaths = ["/", "/login", "/register", "/forgot-password"];
const operatorPaths = ["/products", "/plans", "/customers", "/discounts", "/taxes"];
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [retry, setRetry] = useState(0);
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const publicPage = publicPaths.includes(pathname);
  useEffect(() => {
    let alive = true;
    authService.getCurrentUser().then(value => { if (alive) { setUser(value); setSessionError(""); } })
      .catch(error => { if (alive && !(error instanceof ApiError && error.status === 401)) setSessionError(errorMessage(error)); })
      .finally(() => { if (alive) setIsLoading(false); });
    const ended = () => { setUser(null); setSessionError(""); };
    window.addEventListener(SESSION_EVENT, ended);
    return () => { alive = false; window.removeEventListener(SESSION_EVENT, ended); };
  }, [retry]);
  useEffect(() => {
    if (!isLoading && !user && !publicPage && !sessionError) router.replace("/login");
  }, [isLoading, user, publicPage, sessionError, router]);
  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => session.clear(), Math.max(0, session.expiresAt() - Date.now()));
    return () => window.clearTimeout(timer);
  }, [user]);
  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try { const result = await authService.login(credentials); setUser(result.user); setSessionError(""); router.replace("/dashboard"); }
    finally { setIsLoading(false); }
  };
  const register = async (data: Registration) => {
    setIsLoading(true);
    try { const result = await authService.register(data); setUser(result.user); setSessionError(""); router.replace("/dashboard"); }
    finally { setIsLoading(false); }
  };
  const logout = async () => {
    try { await authService.logout(); setUser(null); router.replace("/login"); }
    catch (error) { if (error instanceof ApiError && error.status === 401) { setUser(null); router.replace("/login"); }
      else toast.error(errorMessage(error), "Could not sign out; please retry"); }
  };
  const role: UserRole = user?.role || "CUSTOMER";
  const canAccess = useCallback((roles: UserRole[]) => !!user && roles.includes(user.role), [user]);
  const forbidden = !!user && ((operatorPaths.some(path => pathname === path || pathname.startsWith(path + "/")) && role === "CUSTOMER") || (pathname.startsWith("/settings") && role !== "ADMIN"));
  let content = children;
  if (!publicPage && (isLoading || !user)) content = <div className="p-12 text-center text-slate-600" role="status">{sessionError || "Loading your session?"}{sessionError && <button className="ml-3 text-indigo-600 underline" onClick={() => { setIsLoading(true); setRetry(value => value + 1); }}>Retry</button>}</div>;
  else if (forbidden) content = <div className="p-12 text-center"><h1 className="text-xl font-bold">Access restricted</h1><p className="my-4">Your account cannot access this page.</p><Link href="/dashboard" className="text-indigo-600">Back to dashboard</Link></div>;
  return <AuthContext.Provider value={{ user, role, isLoading, isAdmin: !!user && role === "ADMIN", isStaff: !!user && role === "STAFF", isCustomer: !!user && role === "CUSTOMER", login, register, logout, canAccess }}>{content}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("AuthProvider is required"); return value; }

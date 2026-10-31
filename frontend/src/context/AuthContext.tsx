"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, UserRole } from "@/types";
import { authService, LoginCredentials } from "@/services/auth.service";
import { useToast } from "./ToastContext";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isLoading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  isCustomer: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: { name: string; email: string; company?: string; role?: UserRole }) => Promise<void>;
  logout: () => Promise<void>;
  switchRole: (role: UserRole) => Promise<void>;
  canAccess: (allowedRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();
  const router = useRouter();

  // Load initial user on mount
  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.error("Failed to load user session", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    try {
      const { user: loggedInUser } = await authService.login(credentials);
      setUser(loggedInUser);
      toast.success(`Welcome back, ${loggedInUser.name}!`, "Signed In");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to sign in. Please verify credentials.", "Login Error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { name: string; email: string; company?: string; role?: UserRole }) => {
    setIsLoading(true);
    try {
      const { user: registeredUser } = await authService.register(data);
      setUser(registeredUser);
      toast.success(`Account created for ${registeredUser.name}!`, "Registration Complete");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to register.", "Registration Error");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
      toast.info("You have been signed out successfully.", "Signed Out");
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  };

  const switchRole = async (targetRole: UserRole) => {
    setIsLoading(true);
    try {
      const updated = await authService.switchRole(targetRole);
      setUser(updated);
      toast.info(`Switched role to ${targetRole} for demo simulation.`, "Role Changed");
    } catch (err: any) {
      toast.error("Failed to switch role.");
    } finally {
      setIsLoading(false);
    }
  };

  const role: UserRole = user?.role || "ADMIN";
  const isAdmin = role === "ADMIN";
  const isStaff = role === "STAFF";
  const isCustomer = role === "CUSTOMER";

  const canAccess = useCallback(
    (allowedRoles: UserRole[]) => {
      return allowedRoles.includes(role);
    },
    [role]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        isLoading,
        isAdmin,
        isStaff,
        isCustomer,
        login,
        register,
        logout,
        switchRole,
        canAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}


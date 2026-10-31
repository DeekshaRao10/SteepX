import { User, UserRole } from "@/types";
import { apiClient, USE_MOCK, delay } from "./api";
import { storage } from "./storage";

export interface LoginCredentials {
  email: string;
  password?: string;
  role?: UserRole;
}

export const authService = {
  login: async (credentials: LoginCredentials): Promise<{ user: User; token: string }> => {
    if (USE_MOCK) {
      await delay(250);
      const users = storage.getUsers();
      // Match by email if found, or by role, or default to admin
      let user = users.find((u) => u.email.toLowerCase() === credentials.email.toLowerCase());
      if (!user && credentials.role) {
        user = users.find((u) => u.role === credentials.role);
      }
      if (!user) {
        // Fallback: create a user on the fly or select first
        user = {
          id: `USR-${Math.floor(100 + Math.random() * 900)}`,
          name: credentials.email.split("@")[0] || "Test User",
          email: credentials.email,
          role: credentials.role || "ADMIN",
          company: "Brightloop Software",
          createdAt: new Date().toISOString(),
        };
      }
      storage.setCurrentUser(user);
      const token = `mock-jwt-token-${user.id}-${Date.now()}`;
      if (typeof window !== "undefined") {
        localStorage.setItem("steepx_auth_token", token);
      }
      return { user, token };
    }

    const response = await apiClient.post("/auth/login", credentials);
    return response.data;
  },

  register: async (data: { name: string; email: string; company?: string; password?: string; role?: UserRole }): Promise<{ user: User; token: string }> => {
    if (USE_MOCK) {
      await delay(300);
      const newUser: User = {
        id: `USR-${Math.floor(100 + Math.random() * 900)}`,
        name: data.name,
        email: data.email,
        company: data.company || "SteepX Workspace",
        role: data.role || "ADMIN",
        createdAt: new Date().toISOString(),
      };
      storage.setCurrentUser(newUser);
      const token = `mock-jwt-token-${newUser.id}-${Date.now()}`;
      if (typeof window !== "undefined") {
        localStorage.setItem("steepx_auth_token", token);
      }
      return { user: newUser, token };
    }

    const response = await apiClient.post("/auth/register", data);
    return response.data;
  },

  getCurrentUser: async (): Promise<User | null> => {
    if (USE_MOCK) {
      await delay(100);
      return storage.getCurrentUser();
    }
    const response = await apiClient.get("/auth/me");
    return response.data;
  },

  switchRole: async (role: UserRole): Promise<User> => {
    await delay(150);
    const users = storage.getUsers();
    let target = users.find((u) => u.role === role);
    if (!target) {
      const current = storage.getCurrentUser();
      target = { ...current, role };
    }
    storage.setCurrentUser(target);
    return target;
  },

  logout: async (): Promise<void> => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("steepx_auth_token");
    }
    await delay(150);
  },
};


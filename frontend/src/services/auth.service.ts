import { User, UserRole } from "@/types";
import { UserResponse, TokenResponse, CustomerResponse } from "@/types/api";
import { apiClient, session } from "./api";

export interface LoginCredentials { email: string; password: string }
export interface Registration extends LoginCredentials { name: string; company?: string }
let currentUser: User | null = null;
export function isCustomerSession() { return currentUser?.role === "CUSTOMER"; }
export function mapUser(data: UserResponse): User {
  return { id: data.id, email: data.email, role: data.role.toUpperCase() as UserRole, name: data.email.split("@")[0],
    customerId: data.role === "customer" ? data.id : undefined, createdAt: data.created_at };
}
async function loadUser(): Promise<User> {
  const { data } = await apiClient.get<UserResponse>("/auth/me");
  const user = mapUser(data);
  if (user.role === "CUSTOMER") {
    const { data: profile } = await apiClient.get<CustomerResponse>("/customers/me");
    user.name = profile.display_name || user.name;
    user.company = profile.company;
  }
  currentUser = user;
  return user;
}
export const authService = {
  async login(credentials: LoginCredentials) {
    const { data } = await apiClient.post<TokenResponse>("/auth/login", credentials);
    session.save(data.access_token, data.expires_in);
    try { return { user: await loadUser(), token: data.access_token }; }
    catch (error) { session.clear(); throw error; }
  },
  async register(data: Registration) {
    await apiClient.post("/auth/register", { email: data.email, password: data.password,
      display_name: data.name, company: data.company || "" });
    return authService.login({ email: data.email, password: data.password });
  },
  async getCurrentUser() {
    if (!session.token()) return null;
    if (session.expiresAt() <= Date.now()) { session.clear(); return null; }
    return loadUser();
  },
  async logout() {
    // Keep the session available for retry if the server cannot revoke it.
    await apiClient.post("/auth/logout");
    currentUser = null;
    session.clear();
  },
};

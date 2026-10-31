import { SubscriptionPlan } from "@/types";
import { apiClient, USE_MOCK, delay } from "./api";
import { storage } from "./storage";

export const planService = {
  getAll: async (): Promise<SubscriptionPlan[]> => {
    if (USE_MOCK) {
      await delay(150);
      return storage.getPlans();
    }
    const response = await apiClient.get<SubscriptionPlan[]>("/plans");
    return response.data;
  },

  getById: async (id: string): Promise<SubscriptionPlan | undefined> => {
    if (USE_MOCK) {
      await delay(150);
      return storage.getPlanById(id);
    }
    const response = await apiClient.get<SubscriptionPlan>(`/plans/${id}`);
    return response.data;
  },

  create: async (data: Omit<SubscriptionPlan, "id" | "createdAt">): Promise<SubscriptionPlan> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.createPlan(data);
    }
    const response = await apiClient.post<SubscriptionPlan>("/plans", data);
    return response.data;
  },

  update: async (id: string, updates: Partial<SubscriptionPlan>): Promise<SubscriptionPlan> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.updatePlan(id, updates);
    }
    const response = await apiClient.put<SubscriptionPlan>(`/plans/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<boolean> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.deletePlan(id);
    }
    await apiClient.delete(`/plans/${id}`);
    return true;
  },
};


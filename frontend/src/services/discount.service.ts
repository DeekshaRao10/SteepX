import { Discount } from "@/types";
import { apiClient, USE_MOCK, delay } from "./api";
import { storage } from "./storage";

export const discountService = {
  getAll: async (): Promise<Discount[]> => {
    if (USE_MOCK) {
      await delay(150);
      return storage.getDiscounts();
    }
    const response = await apiClient.get<Discount[]>("/discounts");
    return response.data;
  },

  getById: async (id: string): Promise<Discount | undefined> => {
    if (USE_MOCK) {
      await delay(150);
      return storage.getDiscountById(id);
    }
    const response = await apiClient.get<Discount>(`/discounts/${id}`);
    return response.data;
  },

  create: async (data: Omit<Discount, "id" | "usedCount" | "createdAt">): Promise<Discount> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.createDiscount(data);
    }
    const response = await apiClient.post<Discount>("/discounts", data);
    return response.data;
  },

  update: async (id: string, updates: Partial<Discount>): Promise<Discount> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.updateDiscount(id, updates);
    }
    const response = await apiClient.put<Discount>(`/discounts/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<boolean> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.deleteDiscount(id);
    }
    await apiClient.delete(`/discounts/${id}`);
    return true;
  },
};


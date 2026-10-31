import { Customer } from "@/types";
import { apiClient, USE_MOCK, delay } from "./api";
import { storage } from "./storage";

export const customerService = {
  getAll: async (): Promise<Customer[]> => {
    if (USE_MOCK) {
      await delay(150);
      return storage.getCustomers();
    }
    const response = await apiClient.get<Customer[]>("/customers");
    return response.data;
  },

  getById: async (id: string): Promise<Customer | undefined> => {
    if (USE_MOCK) {
      await delay(150);
      return storage.getCustomerById(id);
    }
    const response = await apiClient.get<Customer>(`/customers/${id}`);
    return response.data;
  },

  create: async (data: Omit<Customer, "id" | "createdAt" | "totalSpent" | "activeSubscriptionsCount">): Promise<Customer> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.createCustomer(data);
    }
    const response = await apiClient.post<Customer>("/customers", data);
    return response.data;
  },

  update: async (id: string, updates: Partial<Customer>): Promise<Customer> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.updateCustomer(id, updates);
    }
    const response = await apiClient.put<Customer>(`/customers/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<boolean> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.deleteCustomer(id);
    }
    await apiClient.delete(`/customers/${id}`);
    return true;
  },
};


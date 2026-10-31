import { Product } from "@/types";
import { apiClient, USE_MOCK, delay } from "./api";
import { storage } from "./storage";

export const productService = {
  getAll: async (): Promise<Product[]> => {
    if (USE_MOCK) {
      await delay(150);
      return storage.getProducts();
    }
    const response = await apiClient.get<Product[]>("/products");
    return response.data;
  },

  getById: async (id: string): Promise<Product | undefined> => {
    if (USE_MOCK) {
      await delay(150);
      return storage.getProductById(id);
    }
    const response = await apiClient.get<Product>(`/products/${id}`);
    return response.data;
  },

  create: async (data: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.createProduct(data);
    }
    const response = await apiClient.post<Product>("/products", data);
    return response.data;
  },

  update: async (id: string, updates: Partial<Product>): Promise<Product> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.updateProduct(id, updates);
    }
    const response = await apiClient.put<Product>(`/products/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<boolean> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.deleteProduct(id);
    }
    await apiClient.delete(`/products/${id}`);
    return true;
  },
};


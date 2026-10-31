import { Payment } from "@/types";
import { apiClient, USE_MOCK, delay } from "./api";
import { storage } from "./storage";

export const paymentService = {
  getAll: async (customerId?: string): Promise<Payment[]> => {
    if (USE_MOCK) {
      await delay(150);
      let payments = storage.getPayments();
      if (customerId) {
        payments = payments.filter((p) => p.customerId === customerId);
      }
      return payments;
    }
    const response = await apiClient.get<Payment[]>("/payments", {
      params: customerId ? { customer_id: customerId } : {},
    });
    return response.data;
  },

  create: async (data: Omit<Payment, "id" | "paymentNumber" | "createdAt">): Promise<Payment> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.createPayment(data);
    }
    const response = await apiClient.post<Payment>("/payments", data);
    return response.data;
  },
};


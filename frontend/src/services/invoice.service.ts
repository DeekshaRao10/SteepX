import { Invoice } from "@/types";
import { apiClient, USE_MOCK, delay } from "./api";
import { storage } from "./storage";

export const invoiceService = {
  getAll: async (customerId?: string): Promise<Invoice[]> => {
    if (USE_MOCK) {
      await delay(150);
      let invoices = storage.getInvoices();
      if (customerId) {
        invoices = invoices.filter((i) => i.customerId === customerId);
      }
      return invoices;
    }
    const response = await apiClient.get<Invoice[]>("/invoices", {
      params: customerId ? { customer_id: customerId } : {},
    });
    return response.data;
  },

  getById: async (id: string): Promise<Invoice | undefined> => {
    if (USE_MOCK) {
      await delay(150);
      return storage.getInvoiceById(id);
    }
    const response = await apiClient.get<Invoice>(`/invoices/${id}`);
    return response.data;
  },

  create: async (data: Omit<Invoice, "id" | "invoiceNumber" | "paidAmount" | "balanceAmount" | "createdAt">): Promise<Invoice> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.createInvoice(data);
    }
    const response = await apiClient.post<Invoice>("/invoices", data);
    return response.data;
  },

  update: async (id: string, updates: Partial<Invoice>): Promise<Invoice> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.updateInvoice(id, updates);
    }
    const response = await apiClient.put<Invoice>(`/invoices/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<boolean> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.deleteInvoice(id);
    }
    await apiClient.delete(`/invoices/${id}`);
    return true;
  },
};


import { Subscription, SubscriptionStatus, Invoice } from "@/types";
import { apiClient, USE_MOCK, delay } from "./api";
import { storage } from "./storage";

export const subscriptionService = {
  getAll: async (customerId?: string): Promise<Subscription[]> => {
    if (USE_MOCK) {
      await delay(150);
      let subs = storage.getSubscriptions();
      if (customerId) {
        subs = subs.filter((s) => s.customerId === customerId);
      }
      return subs;
    }
    const response = await apiClient.get<Subscription[]>("/subscriptions", {
      params: customerId ? { customer_id: customerId } : {},
    });
    return response.data;
  },

  getById: async (id: string): Promise<Subscription | undefined> => {
    if (USE_MOCK) {
      await delay(150);
      return storage.getSubscriptionById(id);
    }
    const response = await apiClient.get<Subscription>(`/subscriptions/${id}`);
    return response.data;
  },

  create: async (data: Omit<Subscription, "id" | "subscriptionNumber" | "createdAt">): Promise<Subscription> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.createSubscription(data);
    }
    const response = await apiClient.post<Subscription>("/subscriptions", data);
    return response.data;
  },

  update: async (id: string, updates: Partial<Subscription>): Promise<Subscription> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.updateSubscription(id, updates);
    }
    const response = await apiClient.put<Subscription>(`/subscriptions/${id}`, updates);
    return response.data;
  },

  updateStatus: async (id: string, status: SubscriptionStatus): Promise<Subscription> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.updateSubscription(id, { status });
    }
    const response = await apiClient.patch<Subscription>(`/subscriptions/${id}/status`, { status });
    return response.data;
  },

  delete: async (id: string): Promise<boolean> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.deleteSubscription(id);
    }
    await apiClient.delete(`/subscriptions/${id}`);
    return true;
  },

  // Generates an invoice directly from an active or confirmed subscription
  generateInvoice: async (subscriptionId: string): Promise<Invoice> => {
    await delay(250);
    const sub = storage.getSubscriptionById(subscriptionId);
    if (!sub) throw new Error("Subscription not found");

    const issueDate = new Date().toISOString().split("T")[0];
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + 30);
    const dueDate = dueDateObj.toISOString().split("T")[0];

    const items = [
      {
        id: `INV-ITEM-${Date.now()}-1`,
        description: `${sub.productName} (${sub.planName}) x ${sub.quantity}`,
        quantity: sub.quantity,
        unitPrice: sub.unitPrice,
        amount: sub.quantity * sub.unitPrice,
      },
      ...sub.addOns.map((a, idx) => ({
        id: `INV-ITEM-${Date.now()}-${idx + 2}`,
        description: `Add-on: ${a.name} x ${a.quantity}`,
        quantity: a.quantity,
        unitPrice: a.price,
        amount: a.quantity * a.price,
      })),
    ];

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = Math.round(subtotal * 0.1 * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    return storage.createInvoice({
      customerId: sub.customerId,
      customerName: sub.customerName,
      customerEmail: sub.customerEmail,
      subscriptionId: sub.id,
      subscriptionNumber: sub.subscriptionNumber,
      items,
      issueDate,
      dueDate,
      subtotal,
      taxAmount,
      discountAmount: 0,
      totalAmount,
      status: "unpaid",
      paymentTerms: "Net 30",
      notes: `Generated automatically for subscription ${sub.subscriptionNumber}.`,
    });
  },
};


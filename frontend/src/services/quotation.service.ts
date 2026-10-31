import { Quotation, Subscription } from "@/types";
import { apiClient, USE_MOCK, delay } from "./api";
import { storage } from "./storage";

export const quotationService = {
  getAll: async (customerId?: string): Promise<Quotation[]> => {
    if (USE_MOCK) {
      await delay(150);
      let quots = storage.getQuotations();
      if (customerId) {
        quots = quots.filter((q) => q.customerId === customerId);
      }
      return quots;
    }
    const response = await apiClient.get<Quotation[]>("/quotations", {
      params: customerId ? { customer_id: customerId } : {},
    });
    return response.data;
  },

  getById: async (id: string): Promise<Quotation | undefined> => {
    if (USE_MOCK) {
      await delay(150);
      return storage.getQuotationById(id);
    }
    const response = await apiClient.get<Quotation>(`/quotations/${id}`);
    return response.data;
  },

  create: async (data: Omit<Quotation, "id" | "quotationNumber" | "createdAt">): Promise<Quotation> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.createQuotation(data);
    }
    const response = await apiClient.post<Quotation>("/quotations", data);
    return response.data;
  },

  update: async (id: string, updates: Partial<Quotation>): Promise<Quotation> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.updateQuotation(id, updates);
    }
    const response = await apiClient.put<Quotation>(`/quotations/${id}`, updates);
    return response.data;
  },

  delete: async (id: string): Promise<boolean> => {
    if (USE_MOCK) {
      await delay(200);
      return storage.deleteQuotation(id);
    }
    await apiClient.delete(`/quotations/${id}`);
    return true;
  },

  // Converts accepted quotation into a live confirmed subscription
  convertToSubscription: async (quotationId: string): Promise<Subscription> => {
    await delay(250);
    const quotation = storage.getQuotationById(quotationId);
    if (!quotation) throw new Error("Quotation not found");

    const plans = storage.getPlans();
    const defaultPlan = plans[0];

    const startDate = new Date().toISOString().split("T")[0];
    const endDateObj = new Date();
    endDateObj.setFullYear(endDateObj.getFullYear() + 1);
    const endDate = endDateObj.toISOString().split("T")[0];

    // Create confirmed subscription
    const sub = storage.createSubscription({
      customerId: quotation.customerId,
      customerName: quotation.customerName,
      customerEmail: quotation.customerEmail,
      productId: defaultPlan?.productId || "PROD-101",
      productName: defaultPlan?.productName || "Brightloop Cloud Core",
      planId: defaultPlan?.id || "PLAN-201",
      planName: defaultPlan?.name || "Cloud Core Starter",
      quantity: quotation.items[0]?.quantity || 1,
      billingInterval: defaultPlan?.billingInterval || "monthly",
      unitPrice: quotation.items[0]?.unitPrice || defaultPlan?.price || 199,
      amount: quotation.totalAmount,
      addOns: [],
      startDate,
      endDate,
      nextBillingDate: startDate,
      status: "confirmed",
      autoRenew: true,
      notes: `Converted from quotation ${quotation.quotationNumber}`,
    });

    // Mark quotation converted
    storage.updateQuotation(quotationId, {
      status: "converted",
      subscriptionId: sub.id,
    });

    return sub;
  },
};


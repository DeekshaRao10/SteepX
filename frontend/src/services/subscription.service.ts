import { Subscription, SubscriptionStatus } from "@/types";
import { SubscriptionResponse, InvoiceResponse } from "@/types/api";
import { apiClient, listAll, utcDate } from "./api";
import { customerService } from "./customer.service";
import { mapSubscription, mapInvoice } from "./mappers";
export const subscriptionService = {
  async getAll(customerId?: string) {
    const [subs, customers] = await Promise.all([listAll<SubscriptionResponse>("/subscriptions", { customer_id: customerId }), customerService.getAll()]);
    return subs.map(s => mapSubscription(s, customers));
  },
  async getById(id: string) { return mapSubscription((await apiClient.get<SubscriptionResponse>(`/subscriptions/${id}`)).data, await customerService.getAll()); },
  async create(data: Omit<Subscription, "id" | "subscriptionNumber" | "createdAt">) {
    if (!data.quotationId) throw new Error("Create and confirm a quotation before creating a subscription.");
    return mapSubscription((await apiClient.post<SubscriptionResponse>("/subscriptions", { quotation_id: data.quotationId })).data);
  },
  async updateStatus(id: string, status: SubscriptionStatus) {
    const current = await subscriptionService.getById(id);
    const action = status === "active" ? (current.status === "paused" ? "resume" : "activate") : status === "paused" ? "pause" : status === "closed" ? "close" : null;
    if (!action) throw new Error("This subscription transition is not supported.");
    return mapSubscription((await apiClient.post<SubscriptionResponse>(`/subscriptions/${id}/actions/${action}`)).data);
  },
  async delete(id: string) { await subscriptionService.updateStatus(id, "closed"); return true; },
  async renew(id: string, startDate = utcDate(), endDate?: string) { return mapSubscription((await apiClient.post<SubscriptionResponse>(`/subscriptions/${id}/renew`, { start_date: startDate, end_date: endDate || null })).data); },
  async generateInvoice(id: string, periodStart: string, issueDate = utcDate(), dueDate?: string) {
    return mapInvoice((await apiClient.post<InvoiceResponse>(`/subscriptions/${id}/invoices`, {
      period_start: periodStart, issue_date: issueDate, due_date: dueDate || null })).data);
  },
};

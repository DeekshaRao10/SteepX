import { SubscriptionPlan } from "@/types";
import { PlanResponse, PlanWrite } from "@/types/api";
import { apiClient, listAll } from "./api";
import { mapPlan } from "./mappers";
const payload = (data: SubscriptionPlan | Omit<SubscriptionPlan, "id" | "createdAt">): PlanWrite => ({
  name: data.name, product_id: data.productId, tax_rate_id: data.taxRateId || null,
  price: data.price, billing_interval: data.billingInterval, minimum_quantity: data.minimumQuantity,
  available_from: data.availabilityStartDate || null, available_until: data.availabilityEndDate || null,
  end_behavior: data.endBehavior === "auto_renew" ? "renew" : "close", description: data.features.join("\n"),
  is_active: data.status === "active" });
export const planService = {
  async getAll() { return (await listAll<PlanResponse>("/plans")).map(mapPlan); },
  async getById(id: string) { return mapPlan((await apiClient.get<PlanResponse>(`/plans/${id}`)).data); },
  async create(data: Omit<SubscriptionPlan, "id" | "createdAt">) { return mapPlan((await apiClient.post<PlanResponse>("/plans", payload(data))).data); },
  async update(id: string, updates: Partial<SubscriptionPlan>) { return mapPlan((await apiClient.put<PlanResponse>(`/plans/${id}`, payload({ ...await planService.getById(id), ...updates }))).data); },
  async delete(id: string) { await apiClient.delete(`/plans/${id}`); return true; },
};

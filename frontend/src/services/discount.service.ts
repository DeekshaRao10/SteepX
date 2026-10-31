import { Discount } from "@/types";
import { DiscountResponse, DiscountWrite, TaxResponse, TaxWrite } from "@/types/api";
import { apiClient, listAll } from "./api";
import { mapDiscount } from "./mappers";
const payload = (data: Discount | Omit<Discount, "id" | "usedCount" | "createdAt">): DiscountWrite => ({
  code: data.code.trim().toUpperCase(), kind: data.type, value: data.value, currency: data.currency || "USD",
  minimum_purchase: data.minPurchaseAmount || 0, minimum_quantity: data.minQuantity || 1,
  starts_on: data.startDate || null, ends_on: data.expiryDate || null,
  usage_limit: data.usageLimit || null, is_active: data.status !== "disabled" });
export const discountService = {
  async getAll() { return (await listAll<DiscountResponse>("/discounts")).map(mapDiscount); },
  async getById(id: string) { return mapDiscount((await apiClient.get<DiscountResponse>(`/discounts/${id}`)).data); },
  async create(data: Omit<Discount, "id" | "usedCount" | "createdAt">) { return mapDiscount((await apiClient.post<DiscountResponse>("/discounts", payload(data))).data); },
  async update(id: string, updates: Partial<Discount>) { return mapDiscount((await apiClient.put<DiscountResponse>(`/discounts/${id}`, payload({ ...await discountService.getById(id), ...updates }))).data); },
  async delete(id: string) { await apiClient.delete(`/discounts/${id}`); return true; },
};
export const taxService = {
  getAll: () => listAll<TaxResponse>("/tax-rates"),
  async save(data: TaxWrite, id?: string) { return (await (id ? apiClient.put<TaxResponse>(`/tax-rates/${id}`, data) : apiClient.post<TaxResponse>("/tax-rates", data))).data; },
  async archive(id: string) { await apiClient.delete(`/tax-rates/${id}`); },
};

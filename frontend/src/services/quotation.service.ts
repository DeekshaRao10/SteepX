import { Quotation } from "@/types";
import { QuotationResponse, QuotationWrite, SubscriptionResponse, TemplateResponse, TemplateWrite } from "@/types/api";
import { apiClient, listAll, utcDate } from "./api";
import { isCustomerSession } from "./auth.service";
import { customerService } from "./customer.service";
import { mapQuote, mapSubscription } from "./mappers";
export const quotationService = {
  async getAll(customerId?: string) {
    const [quotes, customers] = await Promise.all([listAll<QuotationResponse>("/quotations", { customer_id: customerId }), customerService.getAll()]);
    return quotes.map(q => mapQuote(q, customers));
  },
  async getById(id: string) { return mapQuote((await apiClient.get<QuotationResponse>(`/quotations/${id}`)).data, await customerService.getAll()); },
  async create(data: Omit<Quotation, "id" | "quotationNumber" | "createdAt">) {
    if (!data.templateId && data.items.some(item => !item.planId)) throw new Error("Select a plan for every quotation line.");
    const body: QuotationWrite = {
      ...(!isCustomerSession() ? { customer_id: data.customerId } : {}),
      ...(data.templateId ? { template_id: data.templateId } : { lines: data.items.map(item => ({ plan_id: item.planId!, quantity: item.quantity, variant_ids: item.variantIds || [] })) }),
      start_date: data.startDate || utcDate(), end_date: data.endDate || null,
      valid_until: data.validityDate || null, notes: data.notes || "", discount_code: data.discountCode?.trim().toUpperCase() || null,
    };
    // Save a server-priced draft first. Issuing/accepting it are explicit actions.
    return mapQuote((await apiClient.post<QuotationResponse>("/quotations", body)).data);
  },
  async update(id: string, updates: Partial<Quotation>) {
    const action = ({ sent: "issue", accepted: "confirm", rejected: "close" } as const)[updates.status as "sent" | "accepted" | "rejected"];
    if (!action) throw new Error("Use the quotation lifecycle actions to change its state.");
    return mapQuote((await apiClient.post<QuotationResponse>(`/quotations/${id}/actions/${action}`)).data);
  },
  async delete(id: string) { await quotationService.update(id, { status: "rejected" }); return true; },
  async convertToSubscription(quotationId: string) { return mapSubscription((await apiClient.post<SubscriptionResponse>("/subscriptions", { quotation_id: quotationId })).data); },
  templates: () => listAll<TemplateResponse>("/quotation-templates"),
  async saveTemplate(data: TemplateWrite, id?: string) { return (await (id ? apiClient.put<TemplateResponse>(`/quotation-templates/${id}`, data) : apiClient.post<TemplateResponse>("/quotation-templates", data))).data; },
};

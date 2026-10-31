import { Customer } from "@/types";
import { CustomerResponse, SubscriptionResponse, InvoiceResponse } from "@/types/api";
import { apiClient, listAll } from "./api";
import { isCustomerSession } from "./auth.service";
import { mapCustomer } from "./mappers";
const profile = (data: Partial<Customer>) => ({ display_name: data.name, company: data.company,
  phone: data.phone, billing_address: data.address ? [data.address.street, data.address.city, data.address.state, data.address.postalCode, data.address.country].filter(Boolean).join("\n") : undefined });
export const customerService = {
  async getAll(): Promise<Customer[]> {
    if (isCustomerSession()) return [mapCustomer((await apiClient.get<CustomerResponse>("/customers/me")).data)];
    return (await listAll<CustomerResponse>("/customers")).map(mapCustomer);
  },
  async getWithMetrics(currency = "USD"): Promise<Customer[]> {
    const [customers, subscriptions, invoices] = await Promise.all([customerService.getAll(),
      listAll<SubscriptionResponse>("/subscriptions"), listAll<InvoiceResponse>("/invoices")]);
    return customers.map(customer => ({ ...customer,
      activeSubscriptionsCount: subscriptions.filter(s => s.customer_id === customer.id && s.state === "active").length,
      totalSpent: invoices.filter(i => i.customer_id === customer.id && i.currency === currency).reduce((sum, i) => sum + Number(i.amount_paid), 0) }));
  },
  async getById(id: string) { return mapCustomer((await apiClient.get<CustomerResponse>(`/customers/${id}`)).data); },
  async create(data: Omit<Customer, "id" | "createdAt" | "totalSpent" | "activeSubscriptionsCount">) {
    return mapCustomer((await apiClient.post<CustomerResponse>("/customers/accounts", {
      ...profile(data), email: data.email, password: data.password })).data);
  },
  async update(id: string, data: Partial<Customer>) {
    return mapCustomer((await apiClient.patch<CustomerResponse>(`/customers/${isCustomerSession() ? "me" : id}`, {
      ...profile(data), ...(!isCustomerSession() && data.status ? { is_active: data.status === "active" } : {}) })).data);
  },
  async delete(id: string) { await apiClient.delete(`/customers/${id}`); return true; },
};

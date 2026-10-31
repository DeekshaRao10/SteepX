import { InvoiceResponse } from "@/types/api";
import { apiClient, listAll } from "./api";
import { mapInvoice } from "./mappers";
export const invoiceService = {
  async getAll(customerId?: string) { return (await listAll<InvoiceResponse>("/invoices", { customer_id: customerId })).map(mapInvoice); },
  async getById(id: string) { return mapInvoice((await apiClient.get<InvoiceResponse>(`/invoices/${id}`)).data); },
  async confirm(id: string) { return mapInvoice((await apiClient.post<InvoiceResponse>(`/invoices/${id}/confirm`)).data); },
};

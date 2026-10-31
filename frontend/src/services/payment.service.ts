import { Payment } from "@/types";
import { PaymentResponse, PaymentCreate } from "@/types/api";
import { apiClient, listAll } from "./api";
import { invoiceService } from "./invoice.service";
import { mapPayment } from "./mappers";
export const paymentService = {
  async getAll(customerId?: string) {
    const [payments, invoices] = await Promise.all([listAll<PaymentResponse>("/payments"), invoiceService.getAll(customerId)]);
    const visible = new Set(invoices.map(i => i.id));
    return payments.filter(p => visible.has(p.invoice_id)).map(p => mapPayment(p, invoices));
  },
  async create(data: Omit<Payment, "id" | "paymentNumber" | "createdAt">, idempotencyKey: string) {
    if (!["cash", "bank_transfer", "check", "other"].includes(data.paymentMethod)) throw new Error("Select a supported manual payment method.");
    const body: PaymentCreate = { invoice_id: data.invoiceId, amount: data.amount,
      method: data.paymentMethod as PaymentCreate["method"], payment_date: data.paymentDate.slice(0, 10),
      reference: data.transactionRef.trim() || null, notes: data.notes || "" };
    const result = await apiClient.post<PaymentResponse>("/payments", body, { headers: { "Idempotency-Key": idempotencyKey } });
    return mapPayment(result.data, []);
  },
};

import type * as API from "@/types/api";
import type { Address, Customer, Product, ProductType, SubscriptionPlan, Quotation, QuotationItem, Subscription, Invoice, Discount, Payment, PaymentMethod } from "@/types";

export const shortId = (id: string) => id.slice(0, 8).toUpperCase();
export function mapCustomer(data: API.CustomerResponse): Customer {
  let address: Address = { street: data.billing_address, city: "", state: "", postalCode: "", country: "" };
  try {
    const parsed = JSON.parse(data.billing_address);
    if (parsed && typeof parsed === "object" && typeof parsed.street === "string") address = { ...address, ...parsed };
  } catch { /* Existing free-text billing addresses remain readable. */ }
  return { id: data.id, name: data.display_name || data.email, email: data.email,
    company: data.company, phone: data.phone, address, status: data.is_active ? "active" : "inactive",
    totalSpent: 0, activeSubscriptionsCount: 0, createdAt: data.created_at };
}
export function mapProduct(data: API.ProductResponse, variants: API.VariantResponse[] = []): Product {
  return { id: data.id, code: shortId(data.id), name: data.name, type: data.type as ProductType,
    currency: data.currency, salesPrice: Number(data.sales_price), costPrice: Number(data.cost),
    description: data.notes || "", status: data.is_active ? "active" : "archived",
    createdAt: data.created_at, updatedAt: data.updated_at,
    variants: variants.filter(v => v.kind === "variant").map(v => ({ id: v.id, name: v.name, sku: shortId(v.id), priceDelta: Number(v.additional_price), isActive: v.is_active })),
    addOns: variants.filter(v => v.kind === "addon").map(v => ({ id: v.id, name: v.name, price: Number(v.additional_price), description: "", isActive: v.is_active })) };
}
export function mapPlan(data: API.PlanResponse): SubscriptionPlan {
  return { id: data.id, code: shortId(data.id), name: data.name, productId: data.product_id,
    productName: data.product_name, currency: data.currency, taxRateId: data.tax_rate_id || undefined,
    billingInterval: data.billing_interval, price: Number(data.price), minimumQuantity: data.minimum_quantity ?? 1,
    availabilityStartDate: data.available_from || "", availabilityEndDate: data.available_until || "",
    endBehavior: data.end_behavior === "close" ? "cancel" : "auto_renew", features: (data.description || "").split("\n").filter(Boolean),
    status: data.is_active ? "active" : "inactive", createdAt: data.created_at };
}
export function mapLine(line: API.LineResponse): QuotationItem {
  return { id: line.id, planId: line.plan_id, variantIds: line.selected_variants.map(v => v.id),
    description: line.description, quantity: line.quantity, unitPrice: Number(line.unit_price),
    discountAmount: 0, taxRate: Number(line.tax_rate), total: Number(line.unit_price) * line.quantity };
}
export function mapQuote(data: API.QuotationResponse, customers: Customer[] = []): Quotation {
  const customer = customers.find(c => c.id === data.customer_id);
  return { id: data.id, quotationNumber: `QUO-${shortId(data.id)}`, customerId: data.customer_id,
    customerName: customer?.name || shortId(data.customer_id), customerEmail: customer?.email || "",
    currency: data.currency, items: data.lines.map(mapLine), subtotal: Number(data.subtotal), taxRate: 0,
    taxAmount: Number(data.tax), discountAmount: Number(data.discount), totalAmount: Number(data.total),
    validityDate: data.valid_until, startDate: data.start_date, endDate: data.end_date || "", isExpired: data.is_expired,
    status: ({ draft: "draft", quotation: "sent", confirmed: "accepted", active: "converted", closed: "rejected" } as const)[data.state],
    notes: data.notes, createdAt: data.created_at };
}
export function mapSubscription(data: API.SubscriptionResponse, customers: Customer[] = []): Subscription {
  const customer = customers.find(c => c.id === data.customer_id);
  const first = data.lines[0];
  return { id: data.id, subscriptionNumber: `SUB-${shortId(data.id)}`, customerId: data.customer_id,
    customerName: customer?.name || shortId(data.customer_id), customerEmail: customer?.email || "",
    currency: data.currency, quotationId: data.quotation_id || undefined, lines: data.lines.map(mapLine),
    productId: "", productName: first?.description.split(" / ")[0] || "", planId: first?.plan_id || "",
    planName: first?.description.split(" / ")[1] || "", quantity: first?.quantity || 0,
    billingInterval: data.billing_interval, unitPrice: Number(first?.unit_price || 0),
    amount: data.lines.reduce((sum, line) => sum + Number(line.unit_price) * line.quantity, 0),
    addOns: data.lines.flatMap(line => line.selected_variants.map(v => ({ id: v.id, name: v.name, price: Number(v.additional_price), quantity: line.quantity }))),
    startDate: data.start_date, endDate: data.term_end || "", nextBillingDate: data.next_billing_date,
    status: data.state, autoRenew: data.end_behavior === "renew", createdAt: data.created_at };
}
export function mapInvoice(data: API.InvoiceResponse): Invoice {
  return { id: data.id, invoiceNumber: data.invoice_number, customerId: data.customer_id,
    customerName: data.customer_snapshot.display_name || data.customer_snapshot.email,
    customerEmail: data.customer_snapshot.email, subscriptionId: data.subscription_id,
    subscriptionNumber: `SUB-${shortId(data.subscription_id)}`, currency: data.currency,
    periodStart: data.period_start, periodEnd: data.period_end,
    items: data.lines.map(line => ({ id: line.id, description: line.description, quantity: line.quantity,
      unitPrice: Number(line.unit_price), amount: Number(line.subtotal) })),
    issueDate: data.issue_date, dueDate: data.due_date, subtotal: Number(data.subtotal), taxAmount: Number(data.tax),
    discountAmount: Number(data.discount), totalAmount: Number(data.total), paidAmount: Number(data.amount_paid),
    balanceAmount: Number(data.outstanding_balance), paymentTerms: `Due ${data.due_date}`,
    status: data.status === "confirmed" ? (Number(data.amount_paid) > 0 ? "partially_paid" : "unpaid") : data.status,
    createdAt: data.created_at };
}
export function mapDiscount(data: API.DiscountResponse): Discount {
  return { id: data.id, code: data.code, name: data.code, type: data.kind, value: Number(data.value), currency: data.currency,
    minPurchaseAmount: Number(data.minimum_purchase), minQuantity: data.minimum_quantity,
    startDate: data.starts_on || "", expiryDate: data.ends_on || "", usageLimit: data.usage_limit || undefined,
    usedCount: data.used_count, status: !data.is_active ? "disabled" : data.ends_on && data.ends_on < new Date().toISOString().slice(0, 10) ? "expired" : "active",
    createdAt: data.created_at };
}
export function mapPayment(data: API.PaymentResponse, invoices: Invoice[]): Payment {
  const invoice = invoices.find(i => i.id === data.invoice_id);
  return { id: data.id, paymentNumber: `PAY-${shortId(data.id)}`, invoiceId: data.invoice_id,
    invoiceNumber: invoice?.invoiceNumber || shortId(data.invoice_id), customerId: invoice?.customerId || "",
    customerName: invoice?.customerName || "", currency: invoice?.currency, amount: Number(data.amount),
    paymentMethod: data.method as PaymentMethod, paymentDate: data.payment_date, status: "completed",
    transactionRef: data.reference || "", notes: data.notes, createdAt: data.created_at };
}

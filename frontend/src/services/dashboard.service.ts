import { DashboardStats, RevenueDataPoint, StatusDistribution } from "@/types";
import { DashboardResponse, RevenueReport } from "@/types/api";
import { apiClient, utcDate } from "./api";
import { isCustomerSession } from "./auth.service";
import { invoiceService } from "./invoice.service";
import { paymentService } from "./payment.service";
import { subscriptionService } from "./subscription.service";

export function dateRange(range: string) {
  const end = utcDate();
  if (range === "all") return {};
  const start = new Date(end + "T00:00:00Z");
  if (range === "ytd") start.setUTCMonth(0, 1);
  else start.setUTCDate(start.getUTCDate() - (range === "90d" ? 89 : 29));
  return { date_from: start.toISOString().slice(0, 10), date_to: end };
}
export const dashboardService = {
  async getStats(customerId?: string, range = "all", currency = "USD"): Promise<DashboardStats> {
    const dates = dateRange(range);
    if (isCustomerSession()) {
      const [invoices, payments, subscriptions] = await Promise.all([invoiceService.getAll(customerId), paymentService.getAll(customerId), subscriptionService.getAll(customerId)]);
      const inRange = (date: string) => (!dates.date_from || date >= dates.date_from) && (!dates.date_to || date <= dates.date_to);
      const visible = invoices.filter(i => i.currency === currency && i.status !== "draft" && inRange(i.issueDate));
      return { currency, totalActiveSubscriptions: subscriptions.filter(s => s.status === "active" && s.currency === currency).length,
        revenueCollected: payments.filter(p => p.currency === currency && inRange(p.paymentDate)).reduce((sum, p) => sum + p.amount, 0),
        outstandingAmount: visible.reduce((sum, i) => sum + i.balanceAmount, 0), overdueInvoicesCount: visible.filter(i => i.status === "overdue").length,
        subscriptionsChangePercent: 0, revenueChangePercent: 0, totalCustomersCount: 1, activePlansCount: 0 };
    }
    const { data } = await apiClient.get<DashboardResponse>("/dashboard", { params: { ...dates, currency, customer_id: customerId } });
    return { currency: data.currency, totalActiveSubscriptions: data.active_subscriptions, revenueCollected: Number(data.revenue_collected),
      outstandingAmount: Number(data.outstanding_balance), overdueInvoicesCount: data.overdue_invoice_count,
      subscriptionsChangePercent: 0, revenueChangePercent: 0, totalCustomersCount: 0, activePlansCount: 0 };
  },
  async getMonthlyRevenue(range = "all", currency = "USD"): Promise<RevenueDataPoint[]> {
    if (isCustomerSession()) return [];
    const dates = dateRange(range);
    const invoices = (await invoiceService.getAll()).filter(i => i.currency === currency && i.status !== "draft");
    const earliest = invoices.reduce((date, invoice) => invoice.issueDate < date ? invoice.issueDate : date, utcDate());
    const { data } = await apiClient.get<RevenueReport>("/reports/revenue", { params: { currency, granularity: "month", date_from: dates.date_from || earliest, date_to: dates.date_to || utcDate() } });
    return data.items.map(point => ({ month: point.period.slice(0, 7), revenue: Number(point.collected),
      invoiced: invoices.filter(i => i.issueDate.slice(0, 7) === point.period.slice(0, 7) && i.issueDate >= data.date_from && i.issueDate <= data.date_to).reduce((sum, i) => sum + i.totalAmount, 0) }));
  },
  async getStatusDistribution(currency = "USD"): Promise<StatusDistribution[]> {
    if (isCustomerSession()) return [];
    const { data } = await apiClient.get<DashboardResponse>("/dashboard", { params: { currency } });
    const colors: Record<string, string> = { active: "#10b981", confirmed: "#6366f1", paused: "#f59e0b", closed: "#94a3b8" };
    return Object.entries(data.subscription_counts).map(([status, count]) => ({ status, count, color: colors[status] || "#94a3b8" }));
  },
};

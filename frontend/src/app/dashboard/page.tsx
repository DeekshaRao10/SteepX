"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { dashboardService } from "@/services/dashboard.service";
import { subscriptionService } from "@/services/subscription.service";
import { invoiceService } from "@/services/invoice.service";
import { paymentService } from "@/services/payment.service";
import { DashboardStats, RevenueDataPoint, StatusDistribution, Subscription, Invoice, Payment } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  Repeat,
  DollarSign,
  AlertCircle,
  Clock,
  Plus,
  ArrowRight,
  TrendingUp,
  Receipt,
  Users,
  CreditCard,
  Calendar,
  Layers,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export default function DashboardPage() {
  const { user, role, isCustomer } = useAuth();
  const customerId = isCustomer ? user?.customerId : undefined;

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([]);
  const [recentSubscriptions, setRecentSubscriptions] = useState<Subscription[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [timeRange, setTimeRange] = useState("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [dashStats, rev, dist, subs, invs, pays] = await Promise.all([
          dashboardService.getStats(customerId),
          dashboardService.getMonthlyRevenue(),
          dashboardService.getStatusDistribution(),
          subscriptionService.getAll(customerId),
          invoiceService.getAll(customerId),
          paymentService.getAll(customerId),
        ]);

        setStats(dashStats);
        setRevenueData(rev);
        setStatusDistribution(dist);
        setRecentSubscriptions(subs.slice(0, 5));
        setRecentInvoices(invs.slice(0, 5));
        setRecentPayments(pays.slice(0, 4));
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [customerId]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Welcome & Filter Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                {isCustomer ? `Welcome back, ${user?.name}` : "Executive Billing Dashboard"}
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.5 text-xs font-semibold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                {role} Mode
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isCustomer
                ? `Manage your active subscriptions, invoices, and billing history for ${user?.company || "your organization"}.`
                : "Real-time subscription lifecycle, MRR trends, and financial health telemetry."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Date Range Selector */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 text-xs font-medium text-slate-600 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 ml-2 text-slate-400" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-transparent border-none py-1 px-2.5 focus:outline-hidden text-xs text-slate-700 font-semibold cursor-pointer"
              >
                <option value="30d">Last 30 Days</option>
                <option value="90d">This Quarter</option>
                <option value="ytd">Year to Date</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {!isCustomer && (
              <Link
                href="/subscriptions"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>New Subscription</span>
              </Link>
            )}
          </div>
        </div>

        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Subscriptions"
            value={stats?.totalActiveSubscriptions ?? 0}
            change={12.5}
            changePeriod="vs last month"
            icon={<Repeat className="w-5 h-5 text-indigo-600" />}
          />

          <StatCard
            title={isCustomer ? "Total Paid to Date" : "Revenue Collected"}
            value={formatCurrency(stats?.revenueCollected ?? 0)}
            change={18.2}
            changePeriod="vs last month"
            icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          />

          <StatCard
            title="Outstanding Balance"
            value={formatCurrency(stats?.outstandingAmount ?? 0)}
            change={-4.5}
            changePeriod="unpaid invoices"
            icon={<Clock className="w-5 h-5 text-amber-600" />}
          />

          <StatCard
            title="Overdue Invoices"
            value={stats?.overdueInvoicesCount ?? 0}
            change={stats?.overdueInvoicesCount ? stats.overdueInvoicesCount : 0}
            changePeriod="requiring attention"
            icon={<AlertCircle className="w-5 h-5 text-rose-600" />}
          />
        </div>

        {/* Charts Row */}
        {!isCustomer ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Monthly Revenue Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Revenue & Invoicing Trend</h3>
                  <p className="text-xs text-slate-500">Collected cash receipts vs total billed invoicing</p>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-3 h-3 rounded-full bg-indigo-600" />
                    Revenue
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-3 h-3 rounded-full bg-blue-300" />
                    Billed
                  </span>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorBilled" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#93c5fd" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), ""]}
                      contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                    />
                    <Area type="monotone" dataKey="invoiced" stroke="#93c5fd" strokeWidth={2} fillOpacity={1} fill="url(#colorBilled)" />
                    <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Subscription Status Breakdown Chart */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex flex-col justify-between">
              <div className="pb-4 border-b border-slate-100 mb-2">
                <h3 className="text-base font-bold text-slate-900">Subscription Status</h3>
                <p className="text-xs text-slate-500">Breakdown of customer contracts by lifecycle</p>
              </div>

              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} subscriptions`, name]}
                      contentStyle={{ backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                {statusDistribution.map((item) => (
                  <div key={item.status} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 truncate">{item.status}:</span>
                    <span className="font-bold text-slate-900 ml-auto">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Customer Quick Info Card */
          <div className="bg-linear-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex px-2.5 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 border border-indigo-400/20 text-xs font-semibold mb-2">
                Customer Self-Service Hub
              </div>
              <h2 className="text-xl font-bold">Your Account is in Good Standing</h2>
              <p className="text-xs text-slate-300 mt-1 max-w-lg">
                All cloud clusters and subscriptions are running smoothly. View your upcoming billing schedule or download tax invoices below.
              </p>
            </div>
            <Link
              href="/invoices"
              className="px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5"
            >
              <Receipt className="w-4 h-4" />
              <span>View All Invoices</span>
            </Link>
          </div>
        )}

        {/* Recent Subscriptions & Invoices Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subscriptions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Subscriptions</h3>
                <p className="text-xs text-slate-500">Live active and scheduled plans</p>
              </div>
              <Link
                href="/subscriptions"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-4">Plan / Customer</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSubscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 text-xs">{sub.productName}</p>
                        <p className="text-[11px] text-slate-400">{sub.customerName} • {sub.billingInterval}</p>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={sub.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 text-xs">
                        {formatCurrency(sub.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Recent Invoices</h3>
                <p className="text-xs text-slate-500">Billing statements and payment tracking</p>
              </div>
              <Link
                href="/invoices"
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="py-2.5 px-4">Invoice # / Customer</th>
                    <th className="py-2.5 px-4">Due Date</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 text-xs">{inv.invoiceNumber}</p>
                        <p className="text-[11px] text-slate-400">{inv.customerName}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 text-xs">
                        {formatCurrency(inv.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quick Demo Flow Guidance Banner */}
        {!isCustomer && (
          <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-indigo-950">End-to-End Subscription Lifecycle Walkthrough</h4>
                <p className="text-xs text-indigo-700/80 mt-0.5">
                  1. Add Product → 2. Create Plan → 3. Add Customer → 4. Issue Subscription → 5. Generate Invoice → 6. Record Payment.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/products"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Start with Products
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}


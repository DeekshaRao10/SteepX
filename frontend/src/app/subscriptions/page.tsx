"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { subscriptionService } from "@/services/subscription.service";
import { customerService } from "@/services/customer.service";
import { productService } from "@/services/product.service";
import { planService } from "@/services/plan.service";
import { useAuth } from "@/context/AuthContext";
import {
  Subscription,
  SubscriptionStatus,
  Customer,
  Product,
  SubscriptionPlan,
  SubscriptionSelectedAddon,
} from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import { useRouter } from "next/navigation";
import {
  Repeat,
  Plus,
  Play,
  Pause,
  CheckCircle,
  FileText,
  RotateCw,
  XCircle,
  Eye,
  Trash2,
  Receipt,
  Calendar,
} from "lucide-react";

export default function SubscriptionsPage() {
  const { user, isCustomer } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const customerId = isCustomer ? user?.customerId : undefined;

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<SubscriptionSelectedAddon[]>([]);
  const [notes, setNotes] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [subs, custs, prods, plns] = await Promise.all([
        subscriptionService.getAll(customerId),
        customerService.getAll(),
        productService.getAll(),
        planService.getAll(),
      ]);
      setSubscriptions(subs);
      setCustomers(custs);
      setProducts(prods);
      setPlans(plns);

      if (custs.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custs[0].id);
      }
      if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(prods[0].id);
      }
    } catch (err) {
      toast.error("Failed to load subscriptions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [customerId]);

  // When product changes, adjust selected plan & available plans
  const availablePlans = plans.filter((p) => p.productId === selectedProductId);
  const currentProduct = products.find((p) => p.id === selectedProductId);
  const currentPlan = plans.find((p) => p.id === selectedPlanId) || availablePlans[0];

  useEffect(() => {
    if (availablePlans.length > 0 && (!selectedPlanId || !availablePlans.some((p) => p.id === selectedPlanId))) {
      setSelectedPlanId(availablePlans[0].id);
    }
  }, [selectedProductId, availablePlans, selectedPlanId]);

  // Set default end date (1 year out)
  useEffect(() => {
    const end = new Date(startDate);
    end.setFullYear(end.getFullYear() + 1);
    setEndDate(end.toISOString().split("T")[0]);
  }, [startDate]);

  const handleOpenCreate = () => {
    if (customers.length > 0) setSelectedCustomerId(customers[0].id);
    if (products.length > 0) setSelectedProductId(products[0].id);
    setQuantity(1);
    setSelectedAddons([]);
    setNotes("");
    setIsCreateOpen(true);
  };

  const handleToggleAddon = (addon: { id: string; name: string; price: number }) => {
    setSelectedAddons((prev) => {
      const exists = prev.find((a) => a.id === addon.id);
      if (exists) {
        return prev.filter((a) => a.id !== addon.id);
      } else {
        return [...prev, { id: addon.id, name: addon.name, price: addon.price, quantity: 1 }];
      }
    });
  };

  // Price calculation
  const planUnitPrice = currentPlan?.price || 0;
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + a.price * a.quantity, 0);
  const calculatedTotal = quantity * planUnitPrice + addonsTotal;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === selectedCustomerId);
    const prod = products.find((p) => p.id === selectedProductId);
    const pln = plans.find((p) => p.id === selectedPlanId) || availablePlans[0];

    if (!cust || !prod || !pln) {
      toast.error("Please ensure Customer, Product, and Plan are selected.");
      return;
    }

    try {
      await subscriptionService.create({
        customerId: cust.id,
        customerName: cust.name,
        customerEmail: cust.email,
        productId: prod.id,
        productName: prod.name,
        planId: pln.id,
        planName: pln.name,
        quantity: Number(quantity),
        billingInterval: pln.billingInterval,
        unitPrice: pln.price,
        amount: calculatedTotal,
        addOns: selectedAddons,
        startDate,
        endDate,
        nextBillingDate: startDate,
        status: "active",
        autoRenew: pln.endBehavior === "auto_renew",
        notes,
      });

      toast.success(`Subscription created for ${cust.name}!`, "Subscription Active");
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create subscription.");
    }
  };

  // Status transitions
  const handleStatusChange = async (sub: Subscription, newStatus: SubscriptionStatus, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await subscriptionService.updateStatus(sub.id, newStatus);
      toast.success(`Subscription status changed to ${newStatus.toUpperCase()}`, "Status Updated");
      loadData();
      if (selectedSub?.id === sub.id) {
        setSelectedSub((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      toast.error("Failed to update subscription status.");
    }
  };

  const handleGenerateInvoice = async (sub: Subscription, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const inv = await subscriptionService.generateInvoice(sub.id);
      toast.success(`Invoice ${inv.invoiceNumber} generated!`, "Invoice Created");
      router.push("/invoices");
    } catch (err) {
      toast.error("Failed to generate invoice.");
    }
  };

  const handleOpenDelete = (sub: Subscription, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedSub(sub);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSub) return;
    try {
      await subscriptionService.delete(selectedSub.id);
      toast.info(`Subscription ${selectedSub.subscriptionNumber} deleted.`);
      setIsDeleteOpen(false);
      loadData();
    } catch (err) {
      toast.error("Failed to delete subscription.");
    }
  };

  const filteredSubscriptions = subscriptions.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return true;
  });

  const columns: Column<Subscription>[] = [
    {
      header: "Subscription # / Product",
      cell: (s) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs sm:text-sm">{s.productName}</span>
          <span className="text-[11px] text-slate-400 font-mono">
            {s.subscriptionNumber} • {s.planName} (x{s.quantity})
          </span>
        </div>
      ),
    },
    {
      header: "Customer",
      cell: (s) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800 block">{s.customerName}</span>
          <span className="text-[11px] text-slate-400">{s.customerEmail}</span>
        </div>
      ),
    },
    {
      header: "Billing Cadence",
      cell: (s) => (
        <span className="capitalize px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
          {s.billingInterval}
        </span>
      ),
    },
    {
      header: "Contract Amount",
      cell: (s) => (
        <div>
          <span className="font-bold text-slate-900 text-xs sm:text-sm block">
            {formatCurrency(s.amount)}
          </span>
          {s.addOns.length > 0 && (
            <span className="text-[10px] text-slate-400">+{s.addOns.length} add-ons</span>
          )}
        </div>
      ),
    },
    {
      header: "Next Billing",
      cell: (s) => (
        <span className="text-xs text-slate-500">{formatDate(s.nextBillingDate)}</span>
      ),
    },
    {
      header: "Lifecycle Status",
      cell: (s) => <StatusBadge status={s.status} />,
    },
    {
      header: "Lifecycle Actions",
      className: "text-right",
      cell: (s) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {/* Contextual actions based on current status */}
          {(s.status === "draft" || s.status === "quotation") && (
            <button
              onClick={(e) => handleStatusChange(s, "confirmed", e)}
              title="Confirm Subscription"
              className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Confirm</span>
            </button>
          )}

          {s.status === "confirmed" && (
            <>
              <button
                onClick={(e) => handleStatusChange(s, "active", e)}
                title="Activate Subscription"
                className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Activate</span>
              </button>
              <button
                onClick={(e) => handleGenerateInvoice(s, e)}
                title="Generate Invoice"
                className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Invoice</span>
              </button>
            </>
          )}

          {s.status === "active" && (
            <>
              <button
                onClick={(e) => handleGenerateInvoice(s, e)}
                title="Generate Invoice"
                className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Invoice</span>
              </button>
              <button
                onClick={(e) => handleStatusChange(s, "paused", e)}
                title="Pause Subscription"
                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
              >
                <Pause className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => handleStatusChange(s, "closed", e)}
                title="Close / Cancel Subscription"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}

          {s.status === "paused" && (
            <>
              <button
                onClick={(e) => handleStatusChange(s, "active", e)}
                title="Resume Subscription"
                className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Resume</span>
              </button>
              <button
                onClick={(e) => handleStatusChange(s, "closed", e)}
                title="Close Subscription"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            onClick={() => {
              setSelectedSub(s);
              setIsViewOpen(true);
            }}
            title="View Details"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          {!isCustomer && (
            <button
              onClick={(e) => handleOpenDelete(s, e)}
              title="Delete"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={isCustomer ? "My Subscriptions" : "Subscription Management"}
          description={
            isCustomer
              ? "View and monitor your active recurring services and renewal dates."
              : "End-to-end subscription lifecycle: Draft → Quotation → Confirmed → Active → Closed."
          }
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Subscriptions" },
          ]}
          actions={
            !isCustomer && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Subscription</span>
              </button>
            )
          }
        />

        {/* Lifecycle Flow Indicator */}
        {!isCustomer && (
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Lifecycle Stages:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                1. Draft
              </span>
              <span className="text-slate-300">→</span>
              <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                2. Quotation
              </span>
              <span className="text-slate-300">→</span>
              <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                3. Confirmed
              </span>
              <span className="text-slate-300">→</span>
              <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                4. Active
              </span>
              <span className="text-slate-300">→</span>
              <span className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                5. Closed
              </span>
            </div>
          </div>
        )}

        {/* Data Table with Status Filters */}
        <DataTable
          data={filteredSubscriptions}
          columns={columns}
          isLoading={loading}
          searchPlaceholder="Search subscription by ID, product, or customer..."
          searchFilterKeys={["subscriptionNumber", "productName", "customerName", "planName"]}
          onRowClick={(s) => {
            setSelectedSub(s);
            setIsViewOpen(true);
          }}
          filters={
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="quotation">Quotation</option>
              <option value="confirmed">Confirmed</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="closed">Closed</option>
            </select>
          }
        />

        {/* Modal: Create Subscription Wizard */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create New Subscription"
          description="Provision a subscription contract for a customer with plan, quantities, and add-on modules."
          maxWidth="2xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xs flex items-center gap-1.5"
              >
                <span>Authorize & Provision</span>
              </button>
            </>
          }
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            {/* Step 1: Customer Selection */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Select Customer *</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.company}) — {c.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Product & Plan Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Product *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Subscription Plan *</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                >
                  {availablePlans.map((pln) => (
                    <option key={pln.id} value={pln.id}>
                      {pln.name} ({formatCurrency(pln.price)} / {pln.billingInterval})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Step 3: Quantity & Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Seats / Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            {/* Step 4: Optional Add-ons */}
            {currentProduct && currentProduct.addOns.length > 0 && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Optional Product Add-ons
                </label>
                <div className="space-y-2">
                  {currentProduct.addOns.map((a) => {
                    const isChecked = selectedAddons.some((sel) => sel.id === a.id);
                    return (
                      <label
                        key={a.id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? "bg-indigo-50/50 border-indigo-300 shadow-2xs"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleAddon(a)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-900 block">{a.name}</span>
                            <span className="text-[11px] text-slate-500">{a.description}</span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-slate-900 ml-4">
                          +{formatCurrency(a.price)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pricing Summary Box */}
            <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between mt-4">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Calculated Recurring Amount</span>
                <span className="text-xl font-black">{formatCurrency(calculatedTotal)}</span>
                <span className="text-xs text-slate-400 ml-1">/ {currentPlan?.billingInterval}</span>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-400/20 text-xs font-bold">
                Auto-Renew: {currentPlan?.endBehavior === "auto_renew" ? "Yes" : "No"}
              </span>
            </div>
          </form>
        </Modal>

        {/* Modal: View Details */}
        <Modal
          isOpen={isViewOpen}
          onClose={() => setIsViewOpen(false)}
          title={`Subscription ${selectedSub?.subscriptionNumber}`}
          description={`${selectedSub?.productName} • ${selectedSub?.customerName}`}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              {selectedSub && (
                <button
                  onClick={() => handleGenerateInvoice(selectedSub)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Generate Invoice</span>
                </button>
              )}
              <button
                onClick={() => setIsViewOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          }
        >
          {selectedSub && (
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Status</span>
                  <StatusBadge status={selectedSub.status} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Amount</span>
                  <span className="text-base font-bold text-slate-900">{formatCurrency(selectedSub.amount)}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Cadence</span>
                  <span className="capitalize font-semibold text-slate-800">{selectedSub.billingInterval}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Next Billing</span>
                  <span className="font-semibold text-slate-800">{formatDate(selectedSub.nextBillingDate)}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Plan</span>
                  <span className="font-bold text-slate-800">{selectedSub.planName} (x{selectedSub.quantity} units)</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Contract Window</span>
                  <span className="font-semibold text-slate-800">
                    {formatDate(selectedSub.startDate)} to {formatDate(selectedSub.endDate)}
                  </span>
                </div>
                <div className="flex justify-between pb-2 border-b border-slate-100">
                  <span className="text-slate-500">Customer Email</span>
                  <span className="font-mono text-slate-800">{selectedSub.customerEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Auto-Renewal</span>
                  <span className="font-bold text-indigo-600">{selectedSub.autoRenew ? "Enabled" : "Disabled"}</span>
                </div>
              </div>

              {selectedSub.addOns.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Active Add-ons ({selectedSub.addOns.length})
                  </h5>
                  <div className="space-y-1.5">
                    {selectedSub.addOns.map((a) => (
                      <div key={a.id} className="flex justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                        <span className="font-semibold text-slate-800">{a.name} x {a.quantity}</span>
                        <span className="font-bold text-slate-900">{formatCurrency(a.price * a.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Subscription"
          message={`Are you sure you want to delete ${selectedSub?.subscriptionNumber}? This will discontinue all active billing cycles.`}
          confirmText="Yes, Terminate Subscription"
        />
      </div>
    </AppLayout>
  );
}


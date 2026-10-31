"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { errorMessage, utcDate } from "@/services/api";
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
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [renewTarget, setRenewTarget] = useState<Subscription | null>(null);
  const [renewStart, setRenewStart] = useState(utcDate());
  const [renewEnd, setRenewEnd] = useState("");
  const [renewing, setRenewing] = useState(false);
  const loadData = () => subscriptionService.getAll(customerId).then((data) => { setSubscriptions(data); setLoadError(""); }).catch((error: unknown) => { setLoadError(errorMessage(error)); }).finally(() => setLoading(false));
  useEffect(() => { void loadData(); }, [customerId]);
  const handleOpenCreate = () => router.push("/quotations");
  const handleRenew = async (event: React.FormEvent) => {
    event.preventDefault(); if (!renewTarget || renewing) return; setRenewing(true);
    try { await subscriptionService.renew(renewTarget.id, renewStart, renewEnd); setRenewTarget(null); toast.success("Renewal created. Activate the confirmed subscription when its term starts."); await loadData(); }
    catch (error) { toast.error(errorMessage(error)); }
    finally { setRenewing(false); }
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
      toast.error(errorMessage(err));
    }
  };

  const handleGenerateInvoice = async (sub: Subscription, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const inv = await subscriptionService.generateInvoice(sub.id, sub.nextBillingDate);
      toast.success(`Invoice ${inv.invoiceNumber} generated!`, "Invoice Created");
      router.push("/invoices");
    } catch (err) {
      toast.error(errorMessage(err));
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
      toast.info(`Subscription ${selectedSub.subscriptionNumber} closed.`);
      setIsDeleteOpen(false);
      loadData();
    } catch (err) {
      toast.error(errorMessage(err));
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
      header: "Recurring Subtotal",
      cell: (s) => (
        <div>
          <span className="font-bold text-slate-900 text-xs sm:text-sm block">
            {formatCurrency(s.amount, s.currency)}
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
          {s.status === "closed" && <button onClick={() => { setRenewStart(utcDate()); setRenewEnd(""); setRenewTarget(s); }} className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-md">Renew</button>}
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

            </>
          )}

          {s.status === "active" && (
            <>
              {!isCustomer && s.status === "active" && (<button
                onClick={(e) => handleGenerateInvoice(s, e)}
                title="Generate Invoice"
                className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Invoice</span>
              </button>)}
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
          {s.status !== "closed" && (
            <button
              onClick={(e) => handleOpenDelete(s, e)}
              title="Close Subscription"
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
        {loadError && <div role="alert" className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm">{loadError}<button className="ml-3 underline" onClick={() => void loadData()}>Retry</button></div>}
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
            (
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

        {renewTarget && <Modal isOpen onClose={() => setRenewTarget(null)} title="Renew Subscription" footer={<button form="renew-subscription" type="submit" disabled={renewing} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl">Create Renewal</button>}>
          <form id="renew-subscription" onSubmit={handleRenew} className="space-y-3">
            <label className="block text-sm">Start date<input required type="date" min={utcDate()} value={renewStart} onChange={e => setRenewStart(e.target.value)} className="block border rounded-xl p-2" /></label>
            <label className="block text-sm">End date (optional)<input type="date" min={renewStart} value={renewEnd} onChange={e => setRenewEnd(e.target.value)} className="block border rounded-xl p-2" /></label>
            <p className="text-xs text-slate-500">The renewal uses currently available plans and prices.</p>
          </form>
        </Modal>}

        {/* Modal: View Details */}
        <Modal
          isOpen={isViewOpen}
          onClose={() => setIsViewOpen(false)}
          title={`Subscription ${selectedSub?.subscriptionNumber}`}
          description={`${selectedSub?.productName} • ${selectedSub?.customerName}`}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              {selectedSub && !isCustomer && selectedSub.status === "active" && (
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
                  <span className="text-base font-bold text-slate-900">{formatCurrency(selectedSub.amount, selectedSub.currency)}</span>
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

              <div className="space-y-2">{selectedSub.lines?.map(line => <p key={line.id} className="text-xs text-slate-700">{line.description} ? {line.quantity} ? {formatCurrency(line.total, selectedSub.currency)} before tax and discounts</p>)}</div>
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
          title="Close Subscription"
          message={`Are you sure you want to close ${selectedSub?.subscriptionNumber}? This will discontinue all active billing cycles.`}
          confirmText="Yes, Terminate Subscription"
        />
      </div>
    </AppLayout>
  );
}


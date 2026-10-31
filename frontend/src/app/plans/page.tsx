"use client";
import { errorMessage } from "@/services/api";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { taxService } from "@/services/discount.service";
import { TaxResponse } from "@/types/api";
import { planService } from "@/services/plan.service";
import { productService } from "@/services/product.service";
import { SubscriptionPlan, BillingInterval, PlanEndBehavior, Product } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  LayoutGrid,
  List,
} from "lucide-react";

export default function SubscriptionPlansPage() {
  const { toast } = useToast();
  const [taxes, setTaxes] = useState<TaxResponse[]>([]);
  const [taxRateId, setTaxRateId] = useState("");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters & View mode
  const [intervalFilter, setIntervalFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    productId: "",
    productName: "",
    billingInterval: "monthly" as BillingInterval,
    price: 199,
    minimumQuantity: 1,
    availabilityStartDate: "2026-01-01",
    availabilityEndDate: "2027-12-31",
    endBehavior: "auto_renew" as PlanEndBehavior,
    featuresText: "Unlimited user seats\nPriority 24/7 Slack support\n99.99% SLA guarantee",
    status: "active" as "active" | "inactive",
  });

  const loadData = () => Promise.all([planService.getAll(), productService.getAll(), taxService.getAll()]).then(([plansData, prodsData, taxData]) => { setPlans(plansData); setProducts(prodsData); setTaxes(taxData); if (prodsData.length && !formData.productId) setFormData(previous => ({ ...previous, productId: prodsData[0].id, productName: prodsData[0].name })); setLoadError(""); }).catch((error: unknown) => { setLoadError(errorMessage(error)); }).finally(() => setLoading(false));

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setTaxRateId("");
    const defaultProd = products[0];
    setFormData({
      name: "",
      code: "Assigned automatically",
      productId: defaultProd?.id || "",
      productName: defaultProd?.name || "",
      billingInterval: "monthly",
      price: 199,
      minimumQuantity: 1,
      availabilityStartDate: new Date().toISOString().split("T")[0],
      availabilityEndDate: "2027-12-31",
      endBehavior: "auto_renew",
      featuresText: "High availability clusters\nAutomated daily backups\nAudit logs compliance",
      status: "active",
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setTaxRateId(plan.taxRateId || "");
    setFormData({
      name: plan.name,
      code: plan.code,
      productId: plan.productId,
      productName: plan.productName,
      billingInterval: plan.billingInterval,
      price: plan.price,
      minimumQuantity: plan.minimumQuantity,
      availabilityStartDate: plan.availabilityStartDate,
      availabilityEndDate: plan.availabilityEndDate,
      endBehavior: plan.endBehavior,
      featuresText: plan.features.join("\n"),
      status: plan.status,
    });
    setIsEditOpen(true);
  };

  const handleOpenDelete = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setTaxRateId(plan.taxRateId || "");
    setIsDeleteOpen(true);
  };

  const handleProductSelect = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    setFormData({
      ...formData,
      productId,
      productName: prod?.name || "",
      price: prod?.salesPrice || formData.price,
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const features = formData.featuresText
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);

      await planService.create({
        name: formData.name,
        taxRateId,
        code: formData.code,
        productId: formData.productId,
        productName: formData.productName,
        billingInterval: formData.billingInterval,
        price: Number(formData.price),
        minimumQuantity: Number(formData.minimumQuantity),
        availabilityStartDate: formData.availabilityStartDate,
        availabilityEndDate: formData.availabilityEndDate,
        endBehavior: formData.endBehavior,
        features,
        status: formData.status,
      });

      toast.success(`Plan "${formData.name}" published!`, "Plan Created");
      setIsCreateOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    try {
      const features = formData.featuresText
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);

      await planService.update(selectedPlan.id, {
        name: formData.name,
        taxRateId,
        code: formData.code,
        productId: formData.productId,
        productName: formData.productName,
        billingInterval: formData.billingInterval,
        price: Number(formData.price),
        minimumQuantity: Number(formData.minimumQuantity),
        availabilityStartDate: formData.availabilityStartDate,
        availabilityEndDate: formData.availabilityEndDate,
        endBehavior: formData.endBehavior,
        features,
        status: formData.status,
      });

      toast.success(`Plan "${formData.name}" updated!`, "Changes Saved");
      setIsEditOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedPlan) return;
    try {
      await planService.delete(selectedPlan.id);
      toast.info(`Plan "${selectedPlan.name}" archived.`);
      setIsDeleteOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    }
  };

  const filteredPlans = plans.filter((p) => {
    if (intervalFilter !== "all" && p.billingInterval !== intervalFilter) return false;
    return true;
  });

  const columns: Column<SubscriptionPlan>[] = [
    {
      header: "Plan / Code",
      cell: (p) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs sm:text-sm">{p.name}</span>
          <span className="text-[11px] text-slate-400 font-mono">{p.code}</span>
        </div>
      ),
    },
    {
      header: "Associated Product",
      cell: (p) => <span className="text-xs text-slate-700 font-medium">{p.productName}</span>,
    },
    {
      header: "Billing Cadence",
      cell: (p) => (
        <span className="capitalize px-2 py-0.5 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
          {p.billingInterval}
        </span>
      ),
    },
    {
      header: "Price",
      cell: (p) => (
        <span className="font-bold text-slate-900 text-xs sm:text-sm">
          {formatCurrency(p.price, p.currency)} / {p.billingInterval.replace("ly", "")}
        </span>
      ),
    },
    {
      header: "End Behavior",
      cell: (p) => (
        <span className="text-xs text-slate-500 capitalize">{p.endBehavior.replace("_", " ")}</span>
      ),
    },
    {
      header: "Status",
      cell: (p) => <StatusBadge status={p.status} />,
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (p) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleOpenEdit(p)}
            title="Edit Plan"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenDelete(p)}
            title="Archive Plan"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout allowedRoles={["ADMIN", "STAFF"]}>
      <div className="space-y-6">
        {loadError && <div role="alert" className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm">{loadError}<button className="ml-3 underline" onClick={() => void loadData()}>Retry</button></div>}
        <PageHeader
          title="Subscription Plans & Pricing"
          description="Configure recurring pricing packages, billing intervals, renewal rules, and feature entitlements."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Subscription Plans" },
          ]}
          actions={
            <div className="flex items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === "cards" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Pricing Cards View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-lg transition-colors ${
                    viewMode === "table" ? "bg-white text-indigo-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                  title="Table View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Plan</span>
              </button>
            </div>
          }
        />

        {/* Cadence Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
          {["all", "monthly", "yearly", "weekly", "daily"].map((cadence) => (
            <button
              key={cadence}
              onClick={() => setIntervalFilter(cadence)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                intervalFilter === cadence
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cadence === "all" ? "All Intervals" : `${cadence}`}
            </button>
          ))}
        </div>

        {/* View Mode: Cards View */}
        {viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlans.map((plan) => (
              <div
                key={plan.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between relative group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 block mb-0.5">
                        {plan.productName}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                    </div>
                    <StatusBadge status={plan.status} />
                  </div>

                  <div className="mt-4 mb-6">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {formatCurrency(plan.price, plan.currency)}
                    </span>
                    <span className="text-xs text-slate-500 font-medium ml-1">
                      /{plan.billingInterval.replace("ly", "")}
                    </span>
                    <span className="block text-[11px] text-slate-400 mt-1">
                      Auto-renews: {plan.endBehavior.replace("_", " ")} • Min: {plan.minimumQuantity} qty
                    </span>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2.5 pt-4 border-t border-slate-100">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Included Features
                    </h5>
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-mono">{plan.code}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(plan)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleOpenDelete(plan)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <DataTable
            data={filteredPlans}
            columns={columns}
            isLoading={loading}
            searchPlaceholder="Search plans by name or code..."
            searchFilterKeys={["name", "code", "productName"]}
          />
        )}

        {/* Modal: Create Plan */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Subscription Plan"
          description="Define recurring billing frequency, price, and customer entitlements."
          maxWidth="lg"
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
                type="submit"
                form="form-handleCreateSubmit"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xs"
              >
                Publish Plan
              </button>
            </>
          }
        >
          <form id="form-handleCreateSubmit" onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Plan Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Cloud Scale Pro"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Plan Code *</label>
                <input
                  type="text"
                  required
                  readOnly
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Associated Product *</label>
                <select
                  disabled={isEditOpen}
                  value={formData.productId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.salesPrice, p.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Billing Cadence *</label>
                <select
                  disabled={isEditOpen}
                  value={formData.billingInterval}
                  onChange={(e) => setFormData({ ...formData, billingInterval: e.target.value as BillingInterval })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Price per Interval ($) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Min Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={formData.minimumQuantity}
                  onChange={(e) => setFormData({ ...formData, minimumQuantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Contract End Behavior</label>
                <select
                  value={formData.endBehavior}
                  onChange={(e) => setFormData({ ...formData, endBehavior: e.target.value as PlanEndBehavior })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                >
                  <option value="auto_renew">Auto-Renew</option>
                  
                  <option value="cancel">Cancel</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.availabilityStartDate}
                  onChange={(e) => setFormData({ ...formData, availabilityStartDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.availabilityEndDate}
                  onChange={(e) => setFormData({ ...formData, availabilityEndDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Feature Highlights (1 item per line)
              </label>
              <textarea
                rows={3}
                value={formData.featuresText}
                onChange={(e) => setFormData({ ...formData, featuresText: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              />
            </div>
            <label className="block text-xs font-medium text-slate-700">Tax rate<select value={taxRateId} onChange={e => setTaxRateId(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"><option value="">No tax</option>{taxes.filter(t => t.is_active || t.id === taxRateId).map(t => <option key={t.id} value={t.id}>{t.name} ({t.rate}%) {t.is_active ? "" : "? Inactive"}</option>)}</select></label>
          </form>
        </Modal>

        {/* Modal: Edit Plan */}
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title={`Edit Plan: ${selectedPlan?.name}`}
          maxWidth="lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="form-handleEditSubmit"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xs"
              >
                Save Plan Changes
              </button>
            </>
          }
        >
          <form id="form-handleEditSubmit" onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Plan Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Plan Code</label>
                <input
                  type="text"
                  required
                  readOnly
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Price per Interval ($)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">End Behavior</label>
                <select
                  value={formData.endBehavior}
                  onChange={(e) => setFormData({ ...formData, endBehavior: e.target.value as PlanEndBehavior })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                >
                  <option value="auto_renew">Auto-Renew</option>
                  
                  <option value="cancel">Cancel</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Features (1 item per line)
              </label>
              <textarea
                rows={3}
                value={formData.featuresText}
                onChange={(e) => setFormData({ ...formData, featuresText: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              />
            </div>
            <label className="block text-xs font-medium text-slate-700">Tax rate<select value={taxRateId} onChange={e => setTaxRateId(e.target.value)} className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"><option value="">No tax</option>{taxes.filter(t => t.is_active || t.id === taxRateId).map(t => <option key={t.id} value={t.id}>{t.name} ({t.rate}%) {t.is_active ? "" : "? Inactive"}</option>)}</select></label>
          </form>
        </Modal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
          title="Archive Subscription Plan"
          message={`Archive this plan? Historical records are preserved.`}
          confirmText="Yes, Archive Plan"
        />
      </div>
    </AppLayout>
  );
}


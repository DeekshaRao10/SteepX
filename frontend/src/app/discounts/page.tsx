"use client";
import { errorMessage } from "@/services/api";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { discountService } from "@/services/discount.service";
import { Discount, DiscountType } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import {
  Percent,
  Plus,
  Pencil,
  Trash2,
  Tag,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";

export default function DiscountsPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    currency: "USD",
    code: "",
    name: "",
    type: "percentage" as DiscountType,
    value: 15,
    minPurchaseAmount: 100,
    minQuantity: 1,
    startDate: "2026-01-01",
    expiryDate: "2026-12-31",
    usageLimit: 100,
    status: "active" as "active" | "expired" | "disabled",
  });

  const loadDiscounts = () => discountService.getAll().then((data) => { setDiscounts(data); setLoadError(""); }).catch((error: unknown) => { setLoadError(errorMessage(error)); }).finally(() => setLoading(false));

  useEffect(() => {
    loadDiscounts();
  }, []);

  const handleOpenCreate = () => {
    setFormData({
      currency: "USD",
      code: `PROMO${Math.floor(10 + Math.random() * 90)}`,
      name: "",
      type: "percentage",
      value: 15,
      minPurchaseAmount: 100,
      minQuantity: 1,
      startDate: new Date().toISOString().split("T")[0],
      expiryDate: "2026-12-31",
      usageLimit: 100,
      status: "active",
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (d: Discount) => {
    setSelectedDiscount(d);
    setFormData({
      currency: d.currency || "USD",
      code: d.code,
      name: d.name,
      type: d.type,
      value: d.value,
      minPurchaseAmount: d.minPurchaseAmount || 0,
      minQuantity: d.minQuantity || 1,
      startDate: d.startDate,
      expiryDate: d.expiryDate,
      usageLimit: d.usageLimit || 0,
      status: d.status,
    });
    setIsEditOpen(true);
  };

  const handleOpenDelete = (d: Discount) => {
    setSelectedDiscount(d);
    setIsDeleteOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await discountService.create({
        code: formData.code.toUpperCase().trim(),
        currency: formData.currency,
        name: formData.name,
        type: formData.type,
        value: Number(formData.value),
        minPurchaseAmount: Number(formData.minPurchaseAmount) || undefined,
        minQuantity: Number(formData.minQuantity) || undefined,
        startDate: formData.startDate,
        expiryDate: formData.expiryDate,
        usageLimit: Number(formData.usageLimit) || undefined,
        status: formData.status,
      });

      toast.success(`Discount coupon "${formData.code}" created!`, "Promotion Published");
      setIsCreateOpen(false);
      loadDiscounts();
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDiscount) return;
    try {
      await discountService.update(selectedDiscount.id, {
        code: formData.code.toUpperCase().trim(),
        currency: formData.currency,
        name: formData.name,
        type: formData.type,
        value: Number(formData.value),
        minPurchaseAmount: Number(formData.minPurchaseAmount) || undefined,
        minQuantity: Number(formData.minQuantity) || undefined,
        startDate: formData.startDate,
        expiryDate: formData.expiryDate,
        usageLimit: Number(formData.usageLimit) || undefined,
        status: formData.status,
      });

      toast.success("Discount promotion updated!", "Changes Saved");
      setIsEditOpen(false);
      loadDiscounts();
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedDiscount) return;
    try {
      await discountService.delete(selectedDiscount.id);
      toast.info(`Discount ${selectedDiscount.code} archived.`);
      setIsDeleteOpen(false);
      loadDiscounts();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const filteredDiscounts = discounts.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    return true;
  });

  const columns: Column<Discount>[] = [
    {
      header: "Promo Code / Campaign",
      cell: (d) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-slate-900 block text-xs sm:text-sm font-mono tracking-wide">
              {d.code}
            </span>
            <span className="text-[11px] text-slate-400">{d.name}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Discount Value",
      cell: (d) => (
        <span className="font-bold text-indigo-600 text-xs sm:text-sm">
          {d.type === "percentage" ? `${d.value}% OFF` : `-${formatCurrency(d.value)} FLAT`}
        </span>
      ),
    },
    {
      header: "Eligibility",
      cell: (d) => (
        <span className="text-xs text-slate-500">
          {d.minPurchaseAmount ? `Min ${formatCurrency(d.minPurchaseAmount)}` : "No min spend"}
        </span>
      ),
    },
    {
      header: "Redemption Usage",
      cell: (d) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800">{d.usedCount} used</span>
          <span className="text-slate-400 text-[11px] ml-1">
            {d.usageLimit ? `/ ${d.usageLimit} max` : "(unlimited)"}
          </span>
        </div>
      ),
    },
    {
      header: "Campaign Window",
      cell: (d) => (
        <span className="text-xs text-slate-500">
          {formatDate(d.startDate)} - {formatDate(d.expiryDate)}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (d) => <StatusBadge status={d.status} />,
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (d) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            disabled={!isAdmin}
                onClick={() => handleOpenEdit(d)}
            title="Edit Campaign"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            disabled={!isAdmin}
                onClick={() => handleOpenDelete(d)}
            title="Delete Campaign"
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
        {loadError && <div role="alert" className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm">{loadError}<button className="ml-3 underline" onClick={() => void loadDiscounts()}>Retry</button></div>}
        <PageHeader
          title="Discounts & Coupons"
          description="Manage promotional discount codes, percentage vouchers, and volume billing incentives."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Discounts" },
          ]}
          actions={
            <button
              disabled={!isAdmin}
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Discount</span>
            </button>
          }
        />

        <DataTable
          data={filteredDiscounts}
          columns={columns}
          isLoading={loading}
          searchPlaceholder="Search coupons by code or campaign name..."
          searchFilterKeys={["code", "name"]}
          filters={
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              
              <option value="disabled">Disabled</option>
            </select>
          }
        />

        {/* Modal: Create Discount */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Discount Voucher"
          description="Configure coupons applicable during quotation calculation or checkout."
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
                Create Discount
              </button>
            </>
          }
        >
          <form id="form-handleCreateSubmit" onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SUMMER25"
                  className="w-full px-3 py-2 text-xs sm:text-sm font-mono font-bold uppercase bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Campaign Name *</label>
                <input
                  type="text"
                  required
                  readOnly
                  value={formData.code}
                                    placeholder="e.g. Q3 Growth Campaign"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Discount Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as DiscountType })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Dollar ($)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Value ({formData.type === "percentage" ? "%" : "$"}) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Min Spend Requirement ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.minPurchaseAmount}
                  onChange={(e) => setFormData({ ...formData, minPurchaseAmount: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Total Usage Limit</label>
                <input
                  type="number"
                  min="1"
                  value={formData.usageLimit}
                  onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Valid From</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Expires On</label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>
<label className="block text-xs">Currency<input required minLength={3} maxLength={3} pattern="[A-Z]{3}" className="block w-full border rounded-xl p-2 text-sm" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value.toUpperCase() })} /></label>
          </form>
        </Modal>

        {/* Modal: Edit Discount */}
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title={`Edit Coupon: ${selectedDiscount?.code}`}
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
                Save Changes
              </button>
            </>
          }
        >
          <form id="form-handleEditSubmit" onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  readOnly
                  value={formData.code}
                                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as typeof formData.status })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                >
                  <option value="active">Active</option>
                  
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
<label className="block text-xs">Currency<input required minLength={3} maxLength={3} pattern="[A-Z]{3}" className="block w-full border rounded-xl p-2 text-sm" value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value.toUpperCase() })} /></label>
          </form>
        </Modal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
          title="Archive Coupon"
          message={`Archive this discount? Historical records are preserved.`}
          confirmText="Yes, Archive"
        />
      </div>
    </AppLayout>
  );
}


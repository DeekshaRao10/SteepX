"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { productService } from "@/services/product.service";
import { Product, ProductType } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Layers,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
} from "lucide-react";

export default function ProductsPage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    type: "software" as ProductType,
    salesPrice: 199,
    costPrice: 50,
    description: "",
    status: "active" as "active" | "archived",
  });

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await productService.getAll();
      setProducts(data);
    } catch (err) {
      toast.error("Failed to load products list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleOpenCreate = () => {
    setFormData({
      name: "",
      code: `BL-${Math.floor(100 + Math.random() * 900)}`,
      type: "software",
      salesPrice: 199,
      costPrice: 50,
      description: "",
      status: "active",
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (prod: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProduct(prod);
    setFormData({
      name: prod.name,
      code: prod.code,
      type: prod.type,
      salesPrice: prod.salesPrice,
      costPrice: prod.costPrice,
      description: prod.description,
      status: prod.status,
    });
    setIsEditOpen(true);
  };

  const handleOpenView = (prod: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProduct(prod);
    setIsViewOpen(true);
  };

  const handleOpenDelete = (prod: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProduct(prod);
    setIsDeleteOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await productService.create({
        name: formData.name,
        code: formData.code,
        type: formData.type,
        salesPrice: Number(formData.salesPrice),
        costPrice: Number(formData.costPrice),
        description: formData.description,
        status: formData.status,
        variants: [],
        addOns: [],
      });
      toast.success(`Product "${formData.name}" created successfully!`, "Product Added");
      setIsCreateOpen(false);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to create product.");
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    try {
      await productService.update(selectedProduct.id, {
        name: formData.name,
        code: formData.code,
        type: formData.type,
        salesPrice: Number(formData.salesPrice),
        costPrice: Number(formData.costPrice),
        description: formData.description,
        status: formData.status,
      });
      toast.success(`Product "${formData.name}" updated!`, "Changes Saved");
      setIsEditOpen(false);
      loadProducts();
    } catch (err: any) {
      toast.error(err.message || "Failed to update product.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProduct) return;
    try {
      await productService.delete(selectedProduct.id);
      toast.info(`Product "${selectedProduct.name}" removed.`, "Product Deleted");
      setIsDeleteOpen(false);
      loadProducts();
    } catch (err: any) {
      toast.error("Failed to delete product.");
    }
  };

  // Filtered dataset
  const filteredProducts = products.filter((p) => {
    if (typeFilter !== "all" && p.type !== typeFilter) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  const columns: Column<Product>[] = [
    {
      header: "Product / Code",
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-slate-900 block text-xs sm:text-sm">{p.name}</span>
            <span className="text-[11px] text-slate-400 font-mono">{p.code}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Type",
      cell: (p) => (
        <span className="capitalize px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
          {p.type}
        </span>
      ),
    },
    {
      header: "Sales Price",
      cell: (p) => (
        <span className="font-bold text-slate-900 text-xs sm:text-sm">
          {formatCurrency(p.salesPrice)}
        </span>
      ),
    },
    {
      header: "Cost & Margin",
      cell: (p) => {
        const margin = p.salesPrice - p.costPrice;
        const marginPct = p.salesPrice > 0 ? Math.round((margin / p.salesPrice) * 100) : 0;
        return (
          <div className="text-xs">
            <span className="text-slate-500">{formatCurrency(p.costPrice)} cost</span>
            <span className="text-emerald-600 font-semibold ml-1.5">({marginPct}% margin)</span>
          </div>
        );
      },
    },
    {
      header: "Variants & Add-ons",
      cell: (p) => (
        <span className="text-xs text-slate-500">
          {p.variants.length} var • {p.addOns.length} add-ons
        </span>
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
            onClick={(e) => handleOpenView(p, e)}
            title="View Details"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleOpenEdit(p, e)}
            title="Edit Product"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleOpenDelete(p, e)}
            title="Delete Product"
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
        <PageHeader
          title="Products Catalog"
          description="Manage software editions, services, hardware tiers, and billable items."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Products" },
          ]}
          actions={
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          }
        />

        {/* Data Table with Type and Status Filters */}
        <DataTable
          data={filteredProducts}
          columns={columns}
          isLoading={loading}
          searchPlaceholder="Search product by name or SKU..."
          searchFilterKeys={["name", "code", "description"]}
          onRowClick={(p) => handleOpenView(p)}
          filters={
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:outline-hidden"
              >
                <option value="all">All Types</option>
                <option value="software">Software</option>
                <option value="service">Service</option>
                <option value="hardware">Hardware</option>
                <option value="usage">Usage</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          }
        />

        {/* Modal: Create Product */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Add New SaaS Product"
          description="Create a product definition to associate with subscription plans and line-item billing."
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
                type="button"
                onClick={handleCreateSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xs"
              >
                Create Product
              </button>
            </>
          }
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Brightloop Data Bridge"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Product Code / SKU *</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g. BL-BRIDGE"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Product Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as ProductType })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                >
                  <option value="software">Software</option>
                  <option value="service">Service</option>
                  <option value="hardware">Hardware</option>
                  <option value="usage">Usage-based</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sales Price ($) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.salesPrice}
                  onChange={(e) => setFormData({ ...formData, salesPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cost Price ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed summary of product functionality and features..."
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Lifecycle Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "archived" })}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              >
                <option value="active">Active (Available for subscriptions)</option>
                <option value="archived">Archived (Retired)</option>
              </select>
            </div>
          </form>
        </Modal>

        {/* Modal: Edit Product */}
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title={`Edit Product: ${selectedProduct?.name}`}
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
                type="button"
                onClick={handleEditSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xs"
              >
                Save Changes
              </button>
            </>
          }
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Code / SKU</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Product Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as ProductType })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                >
                  <option value="software">Software</option>
                  <option value="service">Service</option>
                  <option value="hardware">Hardware</option>
                  <option value="usage">Usage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Sales Price ($)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.salesPrice}
                  onChange={(e) => setFormData({ ...formData, salesPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Cost Price ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
              <textarea
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "archived" })}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </form>
        </Modal>

        {/* Modal: View Product Details */}
        <Modal
          isOpen={isViewOpen}
          onClose={() => setIsViewOpen(false)}
          title={selectedProduct?.name || "Product Details"}
          description={`SKU: ${selectedProduct?.code}`}
          maxWidth="lg"
          footer={
            <button
              onClick={() => setIsViewOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
            >
              Close
            </button>
          }
        >
          {selectedProduct && (
            <div className="space-y-5 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Sales Price</span>
                  <span className="text-base font-bold text-slate-900">{formatCurrency(selectedProduct.salesPrice)}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Cost Price</span>
                  <span className="text-base font-bold text-slate-900">{formatCurrency(selectedProduct.costPrice)}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Type</span>
                  <span className="capitalize font-semibold text-slate-800">{selectedProduct.type}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Status</span>
                  <StatusBadge status={selectedProduct.status} />
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Description</h4>
                <p className="text-xs text-slate-600 leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                  {selectedProduct.description || "No description provided."}
                </p>
              </div>

              {/* Variants Section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Configured Variants ({selectedProduct.variants.length})
                </h4>
                {selectedProduct.variants.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No variants configured for this base product.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedProduct.variants.map((v) => (
                      <div key={v.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 text-xs">
                        <span className="font-semibold text-slate-800">{v.name}</span>
                        <span className="text-slate-500 font-mono">
                          +{formatCurrency(v.priceDelta)} delta
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add-ons Section */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Available Add-ons ({selectedProduct.addOns.length})
                </h4>
                {selectedProduct.addOns.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No optional add-ons configured.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedProduct.addOns.map((a) => (
                      <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 text-xs">
                        <div>
                          <p className="font-semibold text-slate-800">{a.name}</p>
                          <p className="text-[11px] text-slate-500">{a.description}</p>
                        </div>
                        <span className="font-bold text-slate-900 ml-4">{formatCurrency(a.price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Product"
          message={`Are you sure you want to remove "${selectedProduct?.name}"? Any active subscriptions referencing this product will retain historical billing data.`}
          confirmText="Yes, Delete Product"
        />
      </div>
    </AppLayout>
  );
}


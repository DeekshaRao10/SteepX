"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { quotationService } from "@/services/quotation.service";
import { customerService } from "@/services/customer.service";
import { productService } from "@/services/product.service";
import { useAuth } from "@/context/AuthContext";
import { Quotation, QuotationItem, QuotationStatus, Customer, Product } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
  Send,
  Repeat,
  Printer,
  Sparkles,
} from "lucide-react";

export default function QuotationsPage() {
  const { user, isCustomer } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const customerId = isCustomer ? user?.customerId : undefined;

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [validityDate, setValidityDate] = useState("");
  const [taxRate, setTaxRate] = useState(10);
  const [notes, setNotes] = useState("");
  const [lineItems, setLineItems] = useState<QuotationItem[]>([
    {
      id: "ITEM-1",
      description: "Brightloop Cloud Core Starter (Annual Tier)",
      quantity: 1,
      unitPrice: 1990,
      discountAmount: 150,
      total: 1840,
    },
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [quots, custs, prods] = await Promise.all([
        quotationService.getAll(customerId),
        customerService.getAll(),
        productService.getAll(),
      ]);
      setQuotations(quots);
      setCustomers(custs);
      setProducts(prods);

      if (custs.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custs[0].id);
      }
    } catch (err) {
      toast.error("Failed to load quotations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const defaultValDate = new Date();
    defaultValDate.setDate(defaultValDate.getDate() + 30);
    setValidityDate(defaultValDate.toISOString().split("T")[0]);
  }, [customerId]);

  const handleOpenCreate = () => {
    if (customers.length > 0) setSelectedCustomerId(customers[0].id);
    const defaultValDate = new Date();
    defaultValDate.setDate(defaultValDate.getDate() + 30);
    setValidityDate(defaultValDate.toISOString().split("T")[0]);
    setTaxRate(10);
    setNotes("Standard enterprise commercial terms apply. Valid for 30 calendar days.");
    setLineItems([
      {
        id: `ITEM-${Date.now()}-1`,
        description: products[0]?.name || "Brightloop Cloud Core",
        quantity: 1,
        unitPrice: products[0]?.salesPrice || 199,
        discountAmount: 0,
        total: products[0]?.salesPrice || 199,
      },
    ]);
    setIsCreateOpen(true);
  };

  const handleAddLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: `ITEM-${Date.now()}-${lineItems.length + 1}`,
        description: "Additional Subscription Module",
        quantity: 1,
        unitPrice: 100,
        discountAmount: 0,
        total: 100,
      },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const handleLineItemChange = (id: string, field: keyof QuotationItem, val: any) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };
        const qty = Number(updated.quantity) || 1;
        const price = Number(updated.unitPrice) || 0;
        const disc = Number(updated.discountAmount) || 0;
        updated.total = Math.max(0, qty * price - disc);
        return updated;
      })
    );
  };

  // Totals Calculation
  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const totalDiscount = lineItems.reduce((sum, item) => sum + item.discountAmount, 0);
  const taxAmount = Math.round((subtotal - totalDiscount) * (taxRate / 100) * 100) / 100;
  const grandTotal = Math.round((subtotal - totalDiscount + taxAmount) * 100) / 100;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === selectedCustomerId);
    if (!cust) {
      toast.error("Please select a customer.");
      return;
    }

    try {
      await quotationService.create({
        customerId: cust.id,
        customerName: cust.name,
        customerEmail: cust.email,
        items: lineItems,
        subtotal,
        taxRate,
        taxAmount,
        discountAmount: totalDiscount,
        totalAmount: grandTotal,
        validityDate,
        status: "sent",
        notes,
      });

      toast.success(`Quotation created and sent to ${cust.name}!`, "Quotation Issued");
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create quotation.");
    }
  };

  const handleConvertToSubscription = async (quotation: Quotation, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const sub = await quotationService.convertToSubscription(quotation.id);
      toast.success(
        `Quotation converted! Subscription ${sub.subscriptionNumber} provisioned.`,
        "Converted to Subscription"
      );
      loadData();
      router.push("/subscriptions");
    } catch (err) {
      toast.error("Failed to convert quotation.");
    }
  };

  const handleStatusChange = async (quotation: Quotation, newStatus: QuotationStatus, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await quotationService.update(quotation.id, { status: newStatus });
      toast.success(`Quotation marked as ${newStatus}.`);
      loadData();
    } catch (err) {
      toast.error("Failed to update quotation status.");
    }
  };

  const handleOpenDelete = (quotation: Quotation, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedQuotation(quotation);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedQuotation) return;
    try {
      await quotationService.delete(selectedQuotation.id);
      toast.info(`Quotation ${selectedQuotation.quotationNumber} deleted.`);
      setIsDeleteOpen(false);
      loadData();
    } catch (err) {
      toast.error("Failed to delete quotation.");
    }
  };

  const filteredQuotations = quotations.filter((q) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    return true;
  });

  const columns: Column<Quotation>[] = [
    {
      header: "Quotation #",
      cell: (q) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs sm:text-sm font-mono">
            {q.quotationNumber}
          </span>
          <span className="text-[11px] text-slate-400">
            {q.items.length} line item{q.items.length > 1 ? "s" : ""}
          </span>
        </div>
      ),
    },
    {
      header: "Customer",
      cell: (q) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800 block">{q.customerName}</span>
          <span className="text-[11px] text-slate-400">{q.customerEmail}</span>
        </div>
      ),
    },
    {
      header: "Subtotal & Discount",
      cell: (q) => (
        <div className="text-xs">
          <span className="text-slate-700 block">{formatCurrency(q.subtotal)}</span>
          {q.discountAmount > 0 && (
            <span className="text-emerald-600 font-semibold">-{formatCurrency(q.discountAmount)} discount</span>
          )}
        </div>
      ),
    },
    {
      header: "Total (incl. tax)",
      cell: (q) => (
        <span className="font-bold text-slate-900 text-xs sm:text-sm">
          {formatCurrency(q.totalAmount)}
        </span>
      ),
    },
    {
      header: "Valid Until",
      cell: (q) => (
        <span className="text-xs text-slate-500">{formatDate(q.validityDate)}</span>
      ),
    },
    {
      header: "Status",
      cell: (q) => <StatusBadge status={q.status} />,
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (q) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {q.status === "sent" && (
            <button
              onClick={(e) => handleStatusChange(q, "accepted", e)}
              title="Accept Quotation"
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
            </button>
          )}

          {q.status === "accepted" && (
            <button
              onClick={(e) => handleConvertToSubscription(q, e)}
              title="Convert to Live Subscription"
              className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <Repeat className="w-3.5 h-3.5" />
              <span>Convert</span>
            </button>
          )}

          <button
            onClick={() => {
              setSelectedQuotation(q);
              setIsViewOpen(true);
            }}
            title="View Details"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          {!isCustomer && (
            <button
              onClick={(e) => handleOpenDelete(q, e)}
              title="Delete Quotation"
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
          title="Quotations & Estimates"
          description="Prepare, send, and convert formal commercial price quotations into active billing subscriptions."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Quotations" },
          ]}
          actions={
            !isCustomer && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>New Quotation</span>
              </button>
            )
          }
        />

        <DataTable
          data={filteredQuotations}
          columns={columns}
          isLoading={loading}
          searchPlaceholder="Search quotations by quote # or customer..."
          searchFilterKeys={["quotationNumber", "customerName", "customerEmail"]}
          onRowClick={(q) => {
            setSelectedQuotation(q);
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
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="converted">Converted</option>
              <option value="rejected">Rejected</option>
            </select>
          }
        />

        {/* Modal: Create Quotation */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Commercial Quotation"
          description="Build multi-item quote proposal with custom pricing, line discounts, and taxes."
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
                <Send className="w-3.5 h-3.5" />
                <span>Send Quotation</span>
              </button>
            </>
          }
        >
          <form onSubmit={handleCreateSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Customer *</label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.company})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Validity Date *</label>
                <input
                  type="date"
                  required
                  value={validityDate}
                  onChange={(e) => setValidityDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            {/* Line items table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Quotation Line Items
                </label>
                <button
                  type="button"
                  onClick={handleAddLineItem}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="col-span-12 sm:col-span-5">
                      <input
                        type="text"
                        required
                        value={item.description}
                        onChange={(e) => handleLineItemChange(item.id, "description", e.target.value)}
                        placeholder="Description..."
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                      <input
                        type="number"
                        min="1"
                        required
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(item.id, "quantity", Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={item.unitPrice}
                        onChange={(e) => handleLineItemChange(item.id, "unitPrice", Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-900"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2 text-right font-bold text-slate-900">
                      {formatCurrency(item.total)}
                    </div>
                    <div className="col-span-1 text-right">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(item.id)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subtotal & Tax Calculation Box */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal:</span>
                <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span className="font-semibold">-{formatCurrency(totalDiscount)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tax Rate (%):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-16 px-2 py-1 text-right bg-slate-50 border border-slate-200 rounded-md font-semibold text-slate-800"
                />
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100 text-sm font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="text-base text-indigo-600">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Terms & Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              />
            </div>
          </form>
        </Modal>

        {/* Modal: View Quotation Details */}
        <Modal
          isOpen={isViewOpen}
          onClose={() => setIsViewOpen(false)}
          title={`Quotation ${selectedQuotation?.quotationNumber}`}
          description={`Customer: ${selectedQuotation?.customerName}`}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              {selectedQuotation?.status === "accepted" && (
                <button
                  onClick={() => handleConvertToSubscription(selectedQuotation)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <Repeat className="w-4 h-4" />
                  <span>Convert to Subscription</span>
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Quote</span>
                </button>
                <button
                  onClick={() => setIsViewOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>
          }
        >
          {selectedQuotation && (
            <div className="space-y-6 text-sm">
              <div className="flex justify-between items-start pb-4 border-b border-slate-200">
                <div>
                  <h4 className="font-extrabold text-lg text-slate-900">SteepX Brightloop SaaS</h4>
                  <p className="text-xs text-slate-500">Commercial Quote & Service Estimate</p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 block font-mono">{selectedQuotation.quotationNumber}</span>
                  <StatusBadge status={selectedQuotation.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Billed To</span>
                  <span className="font-bold text-slate-900 block text-sm">{selectedQuotation.customerName}</span>
                  <span className="text-slate-500">{selectedQuotation.customerEmail}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block font-medium">Valid Until</span>
                  <span className="font-bold text-slate-900 block text-sm">{formatDate(selectedQuotation.validityDate)}</span>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <tr>
                      <th className="p-3 text-left">Description</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedQuotation.items.map((it) => (
                      <tr key={it.id}>
                        <td className="p-3 font-medium text-slate-800">{it.description}</td>
                        <td className="p-3 text-center text-slate-600">{it.quantity}</td>
                        <td className="p-3 text-right text-slate-600">{formatCurrency(it.unitPrice)}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div className="flex justify-end">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(selectedQuotation.subtotal)}</span>
                  </div>
                  {selectedQuotation.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span className="font-semibold">-{formatCurrency(selectedQuotation.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax ({selectedQuotation.taxRate}%):</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(selectedQuotation.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                    <span>Total Amount:</span>
                    <span className="text-base text-indigo-600">{formatCurrency(selectedQuotation.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {selectedQuotation.notes && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                  <span className="font-bold text-slate-700 block mb-0.5">Notes:</span>
                  {selectedQuotation.notes}
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
          title="Delete Quotation"
          message={`Are you sure you want to delete quotation ${selectedQuotation?.quotationNumber}?`}
          confirmText="Yes, Delete"
        />
      </div>
    </AppLayout>
  );
}


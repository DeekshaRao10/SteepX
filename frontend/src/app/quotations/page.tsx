"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { QuotationEditor } from "@/components/common/QuotationEditor";
import { errorMessage } from "@/services/api";
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
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);
  const loadData = () => quotationService.getAll(customerId).then((data) => { setQuotations(data); setLoadError(""); }).catch((error: unknown) => { setLoadError(errorMessage(error)); }).finally(() => setLoading(false));
  useEffect(() => { void loadData(); }, [customerId]);
  const handleOpenCreate = () => setIsCreateOpen(true);

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
      toast.error(errorMessage(err));
    }
  };

  const handleStatusChange = async (quotation: Quotation, newStatus: QuotationStatus, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const updated = await quotationService.update(quotation.id, { status: newStatus });
      if (selectedQuotation?.id === quotation.id) setSelectedQuotation({ ...quotation, ...updated });
      toast.success(`Quotation marked as ${newStatus}.`);
      loadData();
    } catch (err) {
      toast.error(errorMessage(err));
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
      toast.info(`Quotation ${selectedQuotation.quotationNumber} closed.`);
      setIsDeleteOpen(false);
      loadData();
    } catch (err) {
      toast.error(errorMessage(err));
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
          <span className="text-slate-700 block">{formatCurrency(q.subtotal, q.currency)}</span>
          {q.discountAmount > 0 && (
            <span className="text-emerald-600 font-semibold">-{formatCurrency(q.discountAmount, q.currency)} discount</span>
          )}
        </div>
      ),
    },
    {
      header: "Total (incl. tax)",
      cell: (q) => (
        <span className="font-bold text-slate-900 text-xs sm:text-sm">
          {formatCurrency(q.totalAmount, q.currency)}
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
          {q.status === "draft" && !q.isExpired && <button onClick={(e) => handleStatusChange(q, "sent", e)} className="px-2 py-1 text-xs text-indigo-700 bg-indigo-50 rounded-md">Issue</button>}
          {q.status === "sent" && !q.isExpired && (
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
          {["draft", "sent", "accepted"].includes(q.status) && (
            <button
              onClick={(e) => handleOpenDelete(q, e)}
              title="Close Quotation"
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
          title="Quotations & Estimates"
          description="Prepare, send, and convert formal commercial price quotations into active billing subscriptions."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Quotations" },
          ]}
          actions={
            (
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

        {isCreateOpen && <QuotationEditor onClose={() => setIsCreateOpen(false)} onSaved={quote => {
          setIsCreateOpen(false); setSelectedQuotation(quote); setIsViewOpen(true);
          toast.success("Draft saved. Review its totals, then issue and accept the quotation."); void loadData();
        }} />}

        {/* Modal: View Quotation Details */}
        <Modal
          isOpen={isViewOpen}
          onClose={() => setIsViewOpen(false)}
          title={`Quotation ${selectedQuotation?.quotationNumber}`}
          description={`Customer: ${selectedQuotation?.customerName}`}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              {selectedQuotation?.status === "draft" && !selectedQuotation.isExpired && <button onClick={() => handleStatusChange(selectedQuotation, "sent")} className="px-3 py-2 text-xs bg-indigo-600 text-white rounded-xl">Issue Quotation</button>}
              {selectedQuotation?.status === "sent" && !selectedQuotation.isExpired && <button onClick={() => handleStatusChange(selectedQuotation, "accepted")} className="px-3 py-2 text-xs bg-emerald-600 text-white rounded-xl">Accept Quotation</button>}
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
                    <span className="font-semibold text-slate-800">{formatCurrency(selectedQuotation.subtotal, selectedQuotation.currency)}</span>
                  </div>
                  {selectedQuotation.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span className="font-semibold">-{formatCurrency(selectedQuotation.discountAmount, selectedQuotation.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(selectedQuotation.taxAmount, selectedQuotation.currency)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                    <span>Total Amount:</span>
                    <span className="text-base text-indigo-600">{formatCurrency(selectedQuotation.totalAmount, selectedQuotation.currency)}</span>
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
          title="Close Quotation"
          message={`Close this quotation? Historical records are preserved.`}
          confirmText="Yes, Close"
        />
      </div>
    </AppLayout>
  );
}


"use client";

import React, { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { InvoiceGenerator } from "@/components/common/InvoiceGenerator";
import { errorMessage } from "@/services/api";
import { invoiceService } from "@/services/invoice.service";
import { customerService } from "@/services/customer.service";
import { paymentService } from "@/services/payment.service";
import { useAuth } from "@/context/AuthContext";
import { Invoice, InvoiceItem, InvoiceStatus, Customer, PaymentMethod } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import {
  Receipt,
  Plus,
  Eye,
  CreditCard,
  Printer,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  DollarSign,
} from "lucide-react";

export default function InvoicesPage() {
  const { user, isCustomer } = useAuth();
  const { toast } = useToast();

  const customerId = isCustomer ? user?.customerId : undefined;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Payment Form state
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [transactionRef, setTransactionRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [savingPayment, setSavingPayment] = useState(false);
  const paymentPending = useRef(false);
  const paymentKey = useRef("");
  const loadData = () => invoiceService.getAll(customerId).then((data) => { setInvoices(data); setLoadError(""); }).catch((error: unknown) => { setLoadError(errorMessage(error)); }).finally(() => setLoading(false));
  useEffect(() => { void loadData(); }, [customerId]);
  const handleOpenCreate = () => setIsCreateOpen(true);
  const handleConfirmInvoice = async (invoice: Invoice) => {
    try { const updated = await invoiceService.confirm(invoice.id); if (selectedInvoice?.id === invoice.id) setSelectedInvoice(updated); toast.success("Invoice confirmed."); await loadData(); }
    catch (error) { toast.error(errorMessage(error)); }
  };

  const handleOpenPayment = (inv: Invoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    paymentKey.current = crypto.randomUUID();
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setSelectedInvoice(inv);
    setPaymentAmount(inv.balanceAmount);
    setPaymentMethod("bank_transfer");
    setTransactionRef("");
    setPaymentNotes(`Payment for invoice ${inv.invoiceNumber}`);
    setIsPaymentOpen(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || paymentPending.current) return;

    if (paymentAmount <= 0 || paymentAmount > selectedInvoice.balanceAmount) {
      toast.error(`Please enter an amount between $1 and ${formatCurrency(selectedInvoice.balanceAmount, selectedInvoice.currency)}`);
      return;
    }

    paymentPending.current = true; setSavingPayment(true);
    try {
      await paymentService.create({
        invoiceId: selectedInvoice.id,
        invoiceNumber: selectedInvoice.invoiceNumber,
        customerId: selectedInvoice.customerId,
        customerName: selectedInvoice.customerName,
        amount: Number(paymentAmount),
        paymentMethod,
        paymentDate,
        status: "completed",
        transactionRef,
        notes: paymentNotes,
      }, paymentKey.current);

      toast.success(
        `Payment of ${formatCurrency(paymentAmount)} recorded for ${selectedInvoice.invoiceNumber}!`,
        "Payment Processed"
      );
      setIsPaymentOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    } finally { paymentPending.current = false; setSavingPayment(false); }
  };

  const filteredInvoices = invoices.filter((i) => {
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    return true;
  });

  const columns: Column<Invoice>[] = [
    {
      header: "Invoice #",
      cell: (i) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs sm:text-sm font-mono">
            {i.invoiceNumber}
          </span>
          {i.subscriptionNumber && (
            <span className="text-[11px] text-slate-400 font-mono">
              Ref: {i.subscriptionNumber}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Customer",
      cell: (i) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800 block">{i.customerName}</span>
          <span className="text-[11px] text-slate-400">{i.customerEmail}</span>
        </div>
      ),
    },
    {
      header: "Issue / Due Date",
      cell: (i) => (
        <div className="text-xs">
          <span className="text-slate-700 block">Due: {formatDate(i.dueDate)}</span>
          <span className="text-[11px] text-slate-400">Issued: {formatDate(i.issueDate)}</span>
        </div>
      ),
    },
    {
      header: "Total",
      cell: (i) => (
        <span className="font-bold text-slate-900 text-xs sm:text-sm">
          {formatCurrency(i.totalAmount, i.currency)}
        </span>
      ),
    },
    {
      header: "Remaining Balance",
      cell: (i) => (
        <div className="text-xs">
          {i.balanceAmount <= 0 ? (
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Paid
            </span>
          ) : (
            <span className="text-rose-600 font-bold">
              {formatCurrency(i.balanceAmount, i.currency)} due
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      cell: (i) => <StatusBadge status={i.status} />,
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (i) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          {!isCustomer && i.status === "draft" && <button onClick={() => handleConfirmInvoice(i)} className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 rounded-md">Confirm</button>}
          {!isCustomer && i.status !== "draft" && i.balanceAmount > 0 && (
            <button
              onClick={(e) => handleOpenPayment(i, e)}
              title="Record Payment"
              className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Record Payment</span>
            </button>
          )}

          <button
            onClick={() => {
              setSelectedInvoice(i);
              setIsViewOpen(true);
            }}
            title="View Details"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>

        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {loadError && <div role="alert" className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm">{loadError}<button className="ml-3 underline" onClick={() => void loadData()}>Retry</button></div>}
        <PageHeader
          title={isCustomer ? "My Invoices & Receipts" : "Invoices & Receivables"}
          description={
            isCustomer
              ? "View billing statements, payment receipts, and balance status."
              : "Track accounts receivable, automated subscription billings, payment balances, and collection status."
          }
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Invoices" },
          ]}
          actions={
            !isCustomer && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Invoice</span>
              </button>
            )
          }
        />

        <DataTable
          data={filteredInvoices}
          columns={columns}
          isLoading={loading}
          searchPlaceholder="Search invoices by #, customer, or subscription..."
          searchFilterKeys={["invoiceNumber", "customerName", "subscriptionNumber"]}
          onRowClick={(i) => {
            setSelectedInvoice(i);
            setIsViewOpen(true);
          }}
          filters={
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="draft">Draft</option>
            </select>
          }
        />

        {/* Modal: Record Payment on Invoice */}
        <Modal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          title={`Record Payment for ${selectedInvoice?.invoiceNumber}`}
          description={`Customer: ${selectedInvoice?.customerName} • Outstanding Balance: ${formatCurrency(selectedInvoice?.balanceAmount || 0, selectedInvoice?.currency)}`}
          maxWidth="md"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsPaymentOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingPayment}
                form="form-handleRecordPaymentSubmit"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm Payment Receipt</span>
              </button>
            </>
          }
        >
          <form id="form-handleRecordPaymentSubmit" onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              <label className="block text-xs">Payment date<input required type="date" max={new Date().toISOString().slice(0, 10)} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="block w-full border rounded-xl p-2 text-sm" /></label>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Amount to Collect ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedInvoice?.balanceAmount}
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-base font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                >
                  
                  
                  <option value="bank_transfer">Bank Wire</option>
                  
                  <option value="cash">Cash</option><option value="check">Check</option><option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Reference / TX ID</label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Payment Notes</label>
              <textarea
                rows={2}
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              />
            </div>
          </form>
        </Modal>

        {/* Modal: View Invoice Details (Print Friendly) */}
        <Modal
          isOpen={isViewOpen}
          onClose={() => setIsViewOpen(false)}
          title={`Invoice ${selectedInvoice?.invoiceNumber}`}
          description={`Issued: ${formatDate(selectedInvoice?.issueDate || "")}`}
          maxWidth="2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              {selectedInvoice && !isCustomer && selectedInvoice.status === "draft" && <button onClick={() => handleConfirmInvoice(selectedInvoice)} className="px-3 py-2 text-xs bg-indigo-600 text-white rounded-xl">Confirm Invoice</button>}
              {selectedInvoice && !isCustomer && selectedInvoice.status !== "draft" && selectedInvoice.balanceAmount > 0 && (
                <button
                  onClick={() => handleOpenPayment(selectedInvoice)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Record Payment</span>
                </button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Invoice</span>
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
          {selectedInvoice && (
            <div className="space-y-6 text-sm">
              <div className="flex justify-between items-start pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-xl font-black text-slate-900">SteepX Brightloop SaaS</h3>
                  <p className="text-xs text-slate-500">100 Montgomery St, San Francisco, CA</p>
                  <p className="text-xs text-slate-500">tax@brightloop.io • VAT: US-94-3829102</p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-xl text-slate-900 font-mono block">
                    {selectedInvoice.invoiceNumber}
                  </span>
                  <StatusBadge status={selectedInvoice.status} size="md" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Billed To</span>
                  <span className="font-bold text-slate-900 block text-sm">{selectedInvoice.customerName}</span>
                  <span className="text-slate-500">{selectedInvoice.customerEmail}</span>
                  {selectedInvoice.subscriptionNumber && (
                    <span className="text-slate-500 block font-mono mt-1">
                      Subscription: {selectedInvoice.subscriptionNumber}
                    </span>
                  )}
                </div>
                <div className="text-right space-y-1">
                  <div>
                    <span className="text-slate-400 font-medium">Issue Date: </span>
                    <span className="font-semibold text-slate-800">{formatDate(selectedInvoice.issueDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Payment Due: </span>
                    <span className="font-semibold text-rose-600">{formatDate(selectedInvoice.dueDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Payment Terms: </span>
                    <span className="font-semibold text-slate-800">{selectedInvoice.paymentTerms}</span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <tr>
                      <th className="p-3 text-left">Item Description</th>
                      <th className="p-3 text-center">Qty</th>
                      <th className="p-3 text-right">Unit Price</th>
                      <th className="p-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedInvoice.items.map((it) => (
                      <tr key={it.id}>
                        <td className="p-3 font-medium text-slate-800">{it.description}</td>
                        <td className="p-3 text-center text-slate-600">{it.quantity}</td>
                        <td className="p-3 text-right text-slate-600">{formatCurrency(it.unitPrice)}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{formatCurrency(it.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div className="flex justify-end">
                <div className="w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
                  </div>
                  {selectedInvoice.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span className="font-semibold">-{formatCurrency(selectedInvoice.discountAmount, selectedInvoice.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(selectedInvoice.taxAmount, selectedInvoice.currency)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-slate-900">
                    <span>Total Invoiced:</span>
                    <span className="text-sm">{formatCurrency(selectedInvoice.totalAmount, selectedInvoice.currency)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Paid to Date:</span>
                    <span className="font-semibold">-{formatCurrency(selectedInvoice.paidAmount, selectedInvoice.currency)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 font-black text-slate-900">
                    <span>Balance Remaining:</span>
                    <span className={`text-base ${selectedInvoice.balanceAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {formatCurrency(selectedInvoice.balanceAmount, selectedInvoice.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                  <span className="font-bold text-slate-700 block mb-0.5">Payment Instructions:</span>
                  {selectedInvoice.notes}
                </div>
              )}
            </div>
          )}
        </Modal>

        {isCreateOpen && <InvoiceGenerator onClose={() => setIsCreateOpen(false)} onSaved={() => { setIsCreateOpen(false); toast.success("Draft invoice generated. Review and confirm it before recording payment."); void loadData(); }} />}
      </div>
    </AppLayout>
  );
}


"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Payment Form state
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [transactionRef, setTransactionRef] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Create Invoice Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [itemDescription, setItemDescription] = useState("Enterprise Platform Services");
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemUnitPrice, setItemUnitPrice] = useState(299);
  const [discountAmount, setDiscountAmount] = useState(0);

  const loadData = async () => {
    setLoading(true);
    try {
      const [invs, custs] = await Promise.all([
        invoiceService.getAll(customerId),
        customerService.getAll(),
      ]);
      setInvoices(invs);
      setCustomers(custs);
      if (custs.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(custs[0].id);
      }
    } catch (err) {
      toast.error("Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().split("T")[0]);
  }, [customerId]);

  const handleOpenCreate = () => {
    if (customers.length > 0) setSelectedCustomerId(customers[0].id);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().split("T")[0]);
    setItemDescription("Brightloop Cloud Infrastructure Suite");
    setItemQuantity(1);
    setItemUnitPrice(499);
    setDiscountAmount(0);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === selectedCustomerId);
    if (!cust) return;

    const subtotal = itemQuantity * itemUnitPrice;
    const taxAmount = Math.round((subtotal - discountAmount) * 0.1 * 100) / 100;
    const totalAmount = Math.round((subtotal - discountAmount + taxAmount) * 100) / 100;

    try {
      await invoiceService.create({
        customerId: cust.id,
        customerName: cust.name,
        customerEmail: cust.email,
        items: [
          {
            id: `INV-ITEM-${Date.now()}`,
            description: itemDescription,
            quantity: itemQuantity,
            unitPrice: itemUnitPrice,
            amount: subtotal,
          },
        ],
        issueDate,
        dueDate,
        subtotal,
        taxAmount,
        discountAmount,
        totalAmount,
        status: "unpaid",
        paymentTerms: "Net 30",
        notes: "Thank you for your business with Brightloop Software.",
      });

      toast.success("Invoice generated successfully!", "Invoice Created");
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create invoice.");
    }
  };

  const handleOpenPayment = (inv: Invoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedInvoice(inv);
    setPaymentAmount(inv.balanceAmount);
    setPaymentMethod("stripe");
    setTransactionRef(`ch_${Math.random().toString(36).substring(2, 10)}`);
    setPaymentNotes(`Payment for invoice ${inv.invoiceNumber}`);
    setIsPaymentOpen(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    if (paymentAmount <= 0 || paymentAmount > selectedInvoice.balanceAmount) {
      toast.error(`Please enter an amount between $1 and ${formatCurrency(selectedInvoice.balanceAmount)}`);
      return;
    }

    try {
      await paymentService.create({
        invoiceId: selectedInvoice.id,
        invoiceNumber: selectedInvoice.invoiceNumber,
        customerId: selectedInvoice.customerId,
        customerName: selectedInvoice.customerName,
        amount: Number(paymentAmount),
        paymentMethod,
        paymentDate: new Date().toISOString(),
        status: "completed",
        transactionRef,
        notes: paymentNotes,
      });

      toast.success(
        `Payment of ${formatCurrency(paymentAmount)} recorded for ${selectedInvoice.invoiceNumber}!`,
        "Payment Processed"
      );
      setIsPaymentOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to process payment.");
    }
  };

  const handleOpenDelete = (inv: Invoice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedInvoice(inv);
    setIsDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedInvoice) return;
    try {
      await invoiceService.delete(selectedInvoice.id);
      toast.info(`Invoice ${selectedInvoice.invoiceNumber} removed.`);
      setIsDeleteOpen(false);
      loadData();
    } catch (err) {
      toast.error("Failed to delete invoice.");
    }
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
          {formatCurrency(i.totalAmount)}
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
              {formatCurrency(i.balanceAmount)} due
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
          {i.balanceAmount > 0 && (
            <button
              onClick={(e) => handleOpenPayment(i, e)}
              title="Record Payment"
              className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Pay</span>
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
          {!isCustomer && (
            <button
              onClick={(e) => handleOpenDelete(i, e)}
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
          description={`Customer: ${selectedInvoice?.customerName} • Outstanding Balance: ${formatCurrency(selectedInvoice?.balanceAmount || 0)}`}
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
                type="button"
                onClick={handleRecordPaymentSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm Payment Receipt</span>
              </button>
            </>
          }
        >
          <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
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
                  <option value="stripe">Stripe</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="bank_transfer">Bank Wire</option>
                  <option value="paypal">PayPal</option>
                  <option value="cash">Cash / Cheque</option>
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
              {selectedInvoice && selectedInvoice.balanceAmount > 0 && (
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
                    <span className="font-semibold text-slate-800">{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  {selectedInvoice.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span className="font-semibold">-{formatCurrency(selectedInvoice.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax:</span>
                    <span className="font-semibold text-slate-800">{formatCurrency(selectedInvoice.taxAmount)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-slate-900">
                    <span>Total Invoiced:</span>
                    <span className="text-sm">{formatCurrency(selectedInvoice.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Paid to Date:</span>
                    <span className="font-semibold">-{formatCurrency(selectedInvoice.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 font-black text-slate-900">
                    <span>Balance Remaining:</span>
                    <span className={`text-base ${selectedInvoice.balanceAmount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      {formatCurrency(selectedInvoice.balanceAmount)}
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

        {/* Modal: Create Manual Invoice */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Create Manual Invoice"
          description="Directly issue a billing invoice to a customer outside of automated subscription cycles."
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
                Generate & Issue
              </button>
            </>
          }
        >
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Issue Date</label>
                <input
                  type="date"
                  required
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Item Description</label>
              <input
                type="text"
                required
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Unit Price ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Discount ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>
          </form>
        </Modal>

        {/* Delete Confirmation */}
        <ConfirmDialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Invoice"
          message={`Are you sure you want to delete invoice ${selectedInvoice?.invoiceNumber}?`}
          confirmText="Yes, Delete Invoice"
        />
      </div>
    </AppLayout>
  );
}


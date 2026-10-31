"use client";
import { errorMessage } from "@/services/api";

import React, { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, Column } from "@/components/common/DataTable";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { paymentService } from "@/services/payment.service";
import { invoiceService } from "@/services/invoice.service";
import { useAuth } from "@/context/AuthContext";
import { Payment, Invoice, PaymentMethod } from "@/types";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import {
  CreditCard,
  Plus,
  Eye,
  DollarSign,
  TrendingUp,
  Receipt,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default function PaymentsPage() {
  const { user, isCustomer } = useAuth();
  const { toast } = useToast();

  const customerId = isCustomer ? user?.customerId : undefined;

  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [savingPayment, setSavingPayment] = useState(false);
  const paymentPending = useRef(false);
  const paymentKey = useRef("");

  const [currency, setCurrency] = useState("USD");

  // Filter
  const [methodFilter, setMethodFilter] = useState<string>("all");

  // Modals
  const [isRecordOpen, setIsRecordOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Record Form state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("bank_transfer");
  const [transactionRef, setTransactionRef] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = () => Promise.all([paymentService.getAll(customerId), invoiceService.getAll(customerId)]).then(([pays, invs]) => { setPayments(pays); setInvoices(invs); const first = invs.find(i => i.status !== "draft" && i.balanceAmount > 0); if (first && !selectedInvoiceId) { setSelectedInvoiceId(first.id); setAmount(first.balanceAmount); } setLoadError(""); }).catch((error: unknown) => { setLoadError(errorMessage(error)); }).finally(() => setLoading(false));

  useEffect(() => {
    loadData();
  }, [customerId]);

  const unpaidInvoices = invoices.filter((i) => i.status !== "draft" && i.balanceAmount > 0);
  const currentInvoice = invoices.find((i) => i.id === selectedInvoiceId);

  const handleInvoiceSelect = (invId: string) => {
    setSelectedInvoiceId(invId);
    const target = invoices.find((i) => i.id === invId);
    if (target) {
      setAmount(target.balanceAmount);
    }
  };

  const handleOpenRecord = () => {
    paymentKey.current = crypto.randomUUID();
    setPaymentDate(new Date().toISOString().slice(0, 10));
    if (unpaidInvoices.length > 0) {
      setSelectedInvoiceId(unpaidInvoices[0].id);
      setAmount(unpaidInvoices[0].balanceAmount);
    } else {
      setSelectedInvoiceId("");
      setAmount(0);
    }
    setPaymentMethod("bank_transfer");
    setTransactionRef("");
    setNotes("");
    setIsRecordOpen(true);
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentPending.current) return;
    if (!currentInvoice) {
      toast.error("Please select an invoice with an outstanding balance.");
      return;
    }

    if (amount <= 0 || amount > currentInvoice.balanceAmount) {
      toast.error(`Please enter an amount between $1 and ${formatCurrency(currentInvoice.balanceAmount, currentInvoice.currency)}`);
      return;
    }

    paymentPending.current = true; setSavingPayment(true);
    try {
      await paymentService.create({
        invoiceId: currentInvoice.id,
        invoiceNumber: currentInvoice.invoiceNumber,
        customerId: currentInvoice.customerId,
        customerName: currentInvoice.customerName,
        amount: Number(amount),
        paymentMethod,
        paymentDate,
        status: "completed",
        transactionRef,
        notes,
      }, paymentKey.current);

      toast.success(
        `Payment of ${formatCurrency(amount)} recorded for ${currentInvoice.invoiceNumber}!`,
        "Transaction Completed"
      );
      setIsRecordOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    } finally { paymentPending.current = false; setSavingPayment(false); }
  };

  // KPI Calculations
  const totalReceived = payments
    .filter((p) => p.status === "completed" && p.currency === currency)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalOutstanding = invoices
    .filter((i) => i.currency === currency && i.status !== "draft" && i.status !== "paid" && i.status !== "cancelled")
    .reduce((sum, i) => sum + i.balanceAmount, 0);

  const totalOverdue = invoices
    .filter((i) => i.status === "overdue" && i.currency === currency)
    .reduce((sum, i) => sum + i.balanceAmount, 0);

  const filteredPayments = payments.filter((p) => {
    if (methodFilter !== "all" && p.paymentMethod !== methodFilter) return false;
    return true;
  });

  const columns: Column<Payment>[] = [
    {
      header: "Payment #",
      cell: (p) => (
        <div>
          <span className="font-bold text-slate-900 block text-xs sm:text-sm font-mono">
            {p.paymentNumber}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Inv: {p.invoiceNumber}
          </span>
        </div>
      ),
    },
    {
      header: "Customer",
      cell: (p) => (
        <span className="font-semibold text-slate-800 text-xs sm:text-sm block">
          {p.customerName}
        </span>
      ),
    },
    {
      header: "Payment Method",
      cell: (p) => (
        <span className="capitalize px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700">
          {p.paymentMethod.replace("_", " ")}
        </span>
      ),
    },
    {
      header: "Amount Paid",
      cell: (p) => (
        <span className="font-bold text-emerald-600 text-xs sm:text-sm">
          +{formatCurrency(p.amount, p.currency)}
        </span>
      ),
    },
    {
      header: "Date & Reference",
      cell: (p) => (
        <div className="text-xs">
          <span className="text-slate-800 block font-medium">{formatDate(p.paymentDate)}</span>
          <span className="text-[11px] text-slate-400 font-mono">{p.transactionRef}</span>
        </div>
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPayment(p);
            setIsViewOpen(true);
          }}
          title="View Receipt"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <Eye className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {loadError && <div role="alert" className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm">{loadError}<button className="ml-3 underline" onClick={() => void loadData()}>Retry</button></div>}
        <PageHeader
          title={isCustomer ? "Payment History" : "Payments & Finance"}
          description={
            isCustomer
              ? "All payments, settlements, and transactional receipts on your account."
              : "Financial ledger, received transactions, outstanding accounts receivable, and payment reconciliation."
          }
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Payments" },
          ]}
          actions={
            !isCustomer && (
              <button
                onClick={handleOpenRecord}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
            )
          }
        />

        <label className="block text-xs font-semibold text-slate-600">Summary currency <select value={currency} onChange={e => setCurrency(e.target.value)} className="ml-2 px-3 py-2 border rounded-xl bg-white">{[...new Set(["USD", ...invoices.map(i => i.currency || "USD")])].map(code => <option key={code}>{code}</option>)}</select></label>
        {/* Finance KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            title={isCustomer ? "Total Paid by You" : "Total Cash Collected"}
            value={formatCurrency(totalReceived, currency)}
            icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          />

          <StatCard
            title="Outstanding AR Balance"
            value={formatCurrency(totalOutstanding, currency)}
            icon={<Clock className="w-5 h-5 text-amber-600" />}
          />

          <StatCard
            title="Overdue Receivables"
            value={formatCurrency(totalOverdue, currency)}
            icon={<AlertTriangle className="w-5 h-5 text-rose-600" />}
          />
        </div>

        {/* Payment Records Data Table */}
        <DataTable
          data={filteredPayments}
          columns={columns}
          isLoading={loading}
          searchPlaceholder="Search payments by #, customer, or transaction ref..."
          searchFilterKeys={["paymentNumber", "customerName", "invoiceNumber", "transactionRef"]}
          onRowClick={(p) => {
            setSelectedPayment(p);
            setIsViewOpen(true);
          }}
          filters={
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:outline-hidden"
            >
              <option value="all">All Payment Methods</option>
              
              
              <option value="bank_transfer">Bank Wire</option>
              
              <option value="cash">Cash</option><option value="check">Check</option><option value="other">Other</option>
            </select>
          }
        />

        {/* Modal: Record Payment Form */}
        <Modal
          isOpen={isRecordOpen}
          onClose={() => setIsRecordOpen(false)}
          title="Record Received Payment"
          description="Log a cash or digital payment against an outstanding customer invoice."
          maxWidth="lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsRecordOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="form-handleRecordSubmit"
                disabled={savingPayment || unpaidInvoices.length === 0}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xs disabled:opacity-50"
              >
                Post Payment
              </button>
            </>
          }
        >
          {unpaidInvoices.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">All invoices are settled!</p>
              <p className="text-xs text-slate-500">There are no outstanding balances requiring payment.</p>
            </div>
          ) : (
            <form id="form-handleRecordSubmit" onSubmit={handleRecordSubmit} className="space-y-4">
              <label className="block text-xs">Payment date<input required type="date" max={new Date().toISOString().slice(0, 10)} value={paymentDate} onChange={e => setPaymentDate(e.target.value)} className="block w-full border rounded-xl p-2 text-sm" /></label>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Target Invoice (Outstanding Balance) *
                </label>
                <select
                  value={selectedInvoiceId}
                  onChange={(e) => handleInvoiceSelect(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                >
                  {unpaidInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {inv.customerName} ({formatCurrency(inv.balanceAmount, inv.currency)} due)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Amount ({currentInvoice?.currency}) *</label>
                  <input
                    type="number"
                    min="0.01"
                    max={currentInvoice?.balanceAmount}
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-base font-bold bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
                  >
                    
                    
                    <option value="bank_transfer">Bank Wire</option>
                    
                    <option value="cash">Cash</option><option value="check">Check</option><option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Transaction Ref / Cheque #</label>
                <input
                  type="text"
                  maxLength={100}
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </form>
          )}
        </Modal>

        {/* Modal: View Payment Receipt */}
        <Modal
          isOpen={isViewOpen}
          onClose={() => setIsViewOpen(false)}
          title={`Payment Receipt: ${selectedPayment?.paymentNumber}`}
          description={`Processed on ${formatDate(selectedPayment?.paymentDate || "")}`}
          maxWidth="md"
          footer={
            <button
              onClick={() => setIsViewOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
            >
              Close
            </button>
          }
        >
          {selectedPayment && (
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="text-center py-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-1" />
                <span className="text-2xl font-black text-slate-900 block">
                  {formatCurrency(selectedPayment.amount, selectedPayment.currency)}
                </span>
                <span className="text-xs text-emerald-700 font-semibold">Payment Completed</span>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="font-bold text-slate-800">{selectedPayment.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Associated Invoice:</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedPayment.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Payment Method:</span>
                  <span className="capitalize font-semibold text-slate-800">
                    {selectedPayment.paymentMethod.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transaction ID:</span>
                  <span className="font-mono text-slate-800">{selectedPayment.transactionRef}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Date Settled:</span>
                  <span className="text-slate-800">{formatDateTime(selectedPayment.paymentDate)}</span>
                </div>
              </div>

              {selectedPayment.notes && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                  <span className="font-bold text-slate-700 block mb-0.5">Notes:</span>
                  {selectedPayment.notes}
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
}


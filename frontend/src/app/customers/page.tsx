"use client";
import { errorMessage } from "@/services/api";

import React, { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, Column } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { customerService } from "@/services/customer.service";
import { subscriptionService } from "@/services/subscription.service";
import { invoiceService } from "@/services/invoice.service";
import { paymentService } from "@/services/payment.service";
import { Customer, Subscription, Invoice, Payment } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/context/ToastContext";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Building,
  Mail,
  Phone,
  MapPin,
  Repeat,
  Receipt,
  CreditCard,
  FileSpreadsheet,
} from "lucide-react";

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Customer Profile Tabs data
  const [customerSubs, setCustomerSubs] = useState<Subscription[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [customerPayments, setCustomerPayments] = useState<Payment[]>([]);
  const [profileTab, setProfileTab] = useState<"subs" | "invoices" | "payments">("subs");

  const [customerPassword, setCustomerPassword] = useState("");

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    taxNumber: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United States",
    status: "active" as "active" | "inactive" | "suspended",
    notes: "",
  });

  const loadCustomers = () => customerService.getWithMetrics().then((data) => { setCustomers(data); setLoadError(""); }).catch((error: unknown) => { setLoadError(errorMessage(error)); }).finally(() => setLoading(false));

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleOpenCreate = () => {
    setCustomerPassword("");
    setFormData({
      name: "",
      email: "",
      phone: "+1 ",
      company: "",
      taxNumber: "",
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "United States",
      status: "active",
      notes: "",
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (c: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedCustomer(c);
    setFormData({
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      taxNumber: c.taxNumber || "",
      street: c.address.street,
      city: c.address.city,
      state: c.address.state,
      postalCode: c.address.postalCode,
      country: c.address.country,
      status: c.status,
      notes: c.notes || "",
    });
    setIsEditOpen(true);
  };

  const handleOpenView = async (c: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedCustomer(c);
    setIsViewOpen(true);
    try {
      const [subs, invs, pays] = await Promise.all([
        subscriptionService.getAll(c.id),
        invoiceService.getAll(c.id),
        paymentService.getAll(c.id),
      ]);
      setCustomerSubs(subs);
      setCustomerInvoices(invs);
      setCustomerPayments(pays);
    } catch (err) {
      console.error("Error loading customer profile data", err);
    }
  };

  const handleOpenDelete = (c: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedCustomer(c);
    setIsDeleteOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await customerService.create({
        password: customerPassword,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        company: formData.company,
        taxNumber: formData.taxNumber,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country,
        },
        status: formData.status,
        notes: formData.notes,
      });

      toast.success(`Customer "${formData.name}" registered!`, "Customer Created");
      setIsCreateOpen(false);
      loadCustomers();
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    try {
      await customerService.update(selectedCustomer.id, {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        company: formData.company,
        taxNumber: formData.taxNumber,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country,
        },
        status: formData.status,
        notes: formData.notes,
      });

      toast.success(`Customer details updated!`, "Changes Saved");
      setIsEditOpen(false);
      loadCustomers();
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCustomer) return;
    try {
      await customerService.delete(selectedCustomer.id);
      toast.info(`Customer "${selectedCustomer.name}" archived.`);
      setIsDeleteOpen(false);
      loadCustomers();
    } catch (err: unknown) {
      toast.error(errorMessage(err));
    }
  };

  const filteredCustomers = customers.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  const columns: Column<Customer>[] = [
    {
      header: "Customer / Contact",
      cell: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
            {c.name.charAt(0)}
          </div>
          <div>
            <span className="font-bold text-slate-900 block text-xs sm:text-sm">{c.name}</span>
            <span className="text-[11px] text-slate-400">{c.email}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Company",
      cell: (c) => (
        <div className="text-xs">
          <span className="font-semibold text-slate-800 block">{c.company}</span>
          <span className="text-[11px] text-slate-400">{c.address.city}, {c.address.country}</span>
        </div>
      ),
    },
    {
      header: "Subscriptions",
      cell: (c) => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
          <Repeat className="w-3 h-3 text-indigo-600" />
          <span>{c.activeSubscriptionsCount} active</span>
        </span>
      ),
    },
    {
      header: "Total Paid (USD)",
      cell: (c) => (
        <span className="font-bold text-slate-900 text-xs sm:text-sm">
          {formatCurrency(c.totalSpent)}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (c) => <StatusBadge status={c.status} />,
    },
    {
      header: "Actions",
      className: "text-right",
      cell: (c) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => handleOpenView(c, e)}
            title="View Profile"
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleOpenEdit(c, e)}
            title="Edit Customer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleOpenDelete(c, e)}
            title="Archive Customer"
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
        {loadError && <div role="alert" className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm">{loadError}<button className="ml-3 underline" onClick={() => void loadCustomers()}>Retry</button></div>}
        <PageHeader
          title="Customers Directory"
          description="Manage client organizations, billing profiles, subscription portfolios, and invoicing history."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Customers" },
          ]}
          actions={
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Customer</span>
            </button>
          }
        />

        <DataTable
          data={filteredCustomers}
          columns={columns}
          isLoading={loading}
          searchPlaceholder="Search customers by name, company, or email..."
          searchFilterKeys={["name", "company", "email"]}
          onRowClick={(c) => handleOpenView(c)}
          filters={
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 font-medium text-slate-700 focus:bg-white focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              
            </select>
          }
        />

        {/* Modal: Create Customer */}
        <Modal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          title="Register New Customer"
          description="Create a client record to attach subscriptions, quotations, and invoices."
          maxWidth="xl"
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
                Save Customer
              </button>
            </>
          }
        >
          <form id="form-handleCreateSubmit" onSubmit={handleCreateSubmit} className="space-y-4">
            <label className="block text-xs font-medium text-slate-700">Initial password<input required type="password" minLength={9} maxLength={128} autoComplete="new-password" value={customerPassword} onChange={e => setCustomerPassword(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-xl text-sm" /><span className="block mt-1 text-slate-500">9?128 characters with uppercase, lowercase, and a special character. Share securely with the customer.</span></label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Contact Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Elena Rostov"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g. Nexus Robotics"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="elena@company.com"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>


            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Street Address</label>
              <input
                type="text"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                placeholder="500 Technology Square"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">State / Prov</label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Postal Code</label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>


          </form>
        </Modal>

        {/* Modal: Edit Customer */}
        <Modal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          title={`Edit Customer: ${selectedCustomer?.name}`}
          maxWidth="xl"
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
                Save Customer
              </button>
            </>
          }
        >
          <form id="form-handleEditSubmit" onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
                <input
                  type="text"
                  required
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  readOnly
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                  <option value="inactive">Inactive</option>
                  
                </select>
              </div>
            </div>
          </form>
        </Modal>

        {/* Modal: View Customer Profile with Tabs */}
        <Modal
          isOpen={isViewOpen}
          onClose={() => setIsViewOpen(false)}
          title={selectedCustomer?.name || "Customer Profile"}
          description={selectedCustomer?.company}
          maxWidth="2xl"
          footer={
            <button
              onClick={() => setIsViewOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
            >
              Close
            </button>
          }
        >
          {selectedCustomer && (
            <div className="space-y-6 text-sm">
              {/* Profile Top Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Account Status</span>
                  <StatusBadge status={selectedCustomer.status} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Total Paid</span>
                  <span className="text-base font-bold text-slate-900">
                    {formatCurrency(selectedCustomer.totalSpent)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Active Subs</span>
                  <span className="text-base font-bold text-indigo-600">
                    {selectedCustomer.activeSubscriptionsCount}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block font-medium">Customer Since</span>
                  <span className="text-xs font-semibold text-slate-700">
                    {formatDate(selectedCustomer.createdAt)}
                  </span>
                </div>
              </div>

              {/* Tabs: Subscriptions, Invoices, Payments */}
              <div>
                <div className="flex border-b border-slate-200 gap-4 mb-4">
                  <button
                    onClick={() => setProfileTab("subs")}
                    className={`pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                      profileTab === "subs"
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Repeat className="w-4 h-4" />
                    <span>Subscriptions ({customerSubs.length})</span>
                  </button>
                  <button
                    onClick={() => setProfileTab("invoices")}
                    className={`pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                      profileTab === "invoices"
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Invoices ({customerInvoices.length})</span>
                  </button>
                  <button
                    onClick={() => setProfileTab("payments")}
                    className={`pb-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                      profileTab === "payments"
                        ? "border-indigo-600 text-indigo-600"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Payments ({customerPayments.length})</span>
                  </button>
                </div>

                {profileTab === "subs" && (
                  <div className="space-y-2">
                    {customerSubs.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No subscriptions on record.</p>
                    ) : (
                      customerSubs.map((s) => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{s.productName} ({s.planName})</span>
                            <span className="text-[11px] text-slate-400 font-mono">{s.subscriptionNumber} • {s.billingInterval}</span>
                          </div>
                          <div className="text-right">
                            <StatusBadge status={s.status} />
                            <span className="font-bold text-slate-900 block mt-1">{formatCurrency(s.amount, s.currency)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {profileTab === "invoices" && (
                  <div className="space-y-2">
                    {customerInvoices.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No invoices issued yet.</p>
                    ) : (
                      customerInvoices.map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{inv.invoiceNumber}</span>
                            <span className="text-[11px] text-slate-400">Due: {formatDate(inv.dueDate)}</span>
                          </div>
                          <div className="text-right">
                            <StatusBadge status={inv.status} />
                            <span className="font-bold text-slate-900 block mt-1">{formatCurrency(inv.totalAmount, inv.currency)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {profileTab === "payments" && (
                  <div className="space-y-2">
                    {customerPayments.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">No payment transactions on file.</p>
                    ) : (
                      customerPayments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 text-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">{p.paymentNumber} ({p.paymentMethod.replace("_", " ")})</span>
                            <span className="text-[11px] text-slate-400">{formatDate(p.paymentDate)} • Ref: {p.transactionRef}</span>
                          </div>
                          <div className="text-right">
                            <StatusBadge status={p.status} />
                            <span className="font-bold text-emerald-600 block mt-1">+{formatCurrency(p.amount, p.currency)}</span>
                          </div>
                        </div>
                      ))
                    )}
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
          title="Archive Customer"
          message={`Archive this customer? Historical records are preserved.`}
          confirmText="Yes, Archive Customer"
        />
      </div>
    </AppLayout>
  );
}


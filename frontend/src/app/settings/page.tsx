"use client";

import React, { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { RoleBadge } from "@/components/common/RoleBadge";
import { Modal } from "@/components/common/Modal";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/services/storage";
import { User, UserRole } from "@/types";
import { useToast } from "@/context/ToastContext";
import {
  Settings,
  Users,
  Building,
  Key,
  RotateCcw,
  Plus,
  Shield,
  CheckCircle2,
  AlertCircle,
  Server,
} from "lucide-react";

export default function SettingsPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"staff" | "org" | "api">("staff");
  const [usersList, setUsersList] = useState<User[]>(storage.getUsers());

  // Add Staff Modal state
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffRole, setStaffRole] = useState<UserRole>("STAFF");

  // Org Settings State
  const [companyName, setCompanyName] = useState("Brightloop Software, Inc.");
  const [supportEmail, setSupportEmail] = useState("billing@brightloop.io");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("America/Los_Angeles");

  const handleAddStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffEmail.includes("@")) {
      toast.error("Please enter a valid staff name and business email.");
      return;
    }

    const newStaff: User = {
      id: `USR-${Math.floor(100 + Math.random() * 900)}`,
      name: staffName,
      email: staffEmail,
      role: staffRole,
      company: companyName,
      createdAt: new Date().toISOString(),
    };

    const currentUsers = storage.getUsers();
    const updated = [...currentUsers, newStaff];
    setUsersList(updated);
    toast.success(`Staff member ${staffName} invited as ${staffRole}!`, "Staff Added");
    setIsAddStaffOpen(false);
    setStaffName("");
    setStaffEmail("");
  };

  const handleSaveOrg = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Organization profile updated successfully!", "Settings Saved");
  };

  const handleResetData = () => {
    storage.resetAll();
    toast.success("All mock data restored to default demonstration baseline!", "Reset Complete");
    window.location.reload();
  };

  return (
    <AppLayout allowedRoles={["ADMIN"]}>
      <div className="space-y-6">
        <PageHeader
          title="Workspace Settings & Administration"
          description="Manage team staff roles, organization profile, billing defaults, and backend integration status."
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Settings" },
          ]}
          actions={
            <button
              onClick={handleResetData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Demo State</span>
            </button>
          }
        />

        {/* Settings Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-6">
          <button
            onClick={() => setActiveTab("staff")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "staff"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Staff & Team Access</span>
          </button>
          <button
            onClick={() => setActiveTab("org")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "org"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Organization Profile</span>
          </button>
          <button
            onClick={() => setActiveTab("api")}
            className={`pb-3 text-xs sm:text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "api"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Server className="w-4 h-4" />
            <span>FastAPI Integration</span>
          </button>
        </div>

        {/* Tab 1: Staff & Team */}
        {activeTab === "staff" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Workspace Members</h3>
                <p className="text-xs text-slate-500">
                  Control staff permissions, role assignment, and administrative access.
                </p>
              </div>
              <button
                onClick={() => setIsAddStaffOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Invite Staff</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-6">Name / Email</th>
                    <th className="py-3 px-6">Role Tier</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Access Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-xs sm:text-sm">{u.name}</span>
                            <span className="text-[11px] text-slate-400">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-6">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="py-3.5 px-6">
                        <StatusBadge status="active" />
                      </td>
                      <td className="py-3.5 px-6 text-right text-xs font-medium text-slate-500">
                        {u.role === "ADMIN" ? "Full Superadmin" : u.role === "STAFF" ? "Operations & Billing" : "Customer Portal"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Organization Profile */}
        {activeTab === "org" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs max-w-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-1">Company Information</h3>
            <p className="text-xs text-slate-500 mb-6">
              Details displayed on customer quotations, invoices, and billing statements.
            </p>

            <form onSubmit={handleSaveOrg} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Billing Support Email</label>
                  <input
                    type="email"
                    required
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Default Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                  >
                    <option value="USD">USD ($ - US Dollar)</option>
                    <option value="EUR">EUR (€ - Euro)</option>
                    <option value="GBP">GBP (£ - British Pound)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Default Timezone</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xs"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: FastAPI Backend Integration */}
        {activeTab === "api" && (
          <div className="space-y-6 max-w-3xl">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Server className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-slate-900">Backend API Connectivity</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Prepared for seamless coupling with your teammate&apos;s FastAPI & PostgreSQL backend.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-700 block">Target Base Endpoint URL</span>
                    <span className="font-mono text-slate-500">
                      {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    Client Ready
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <span className="font-bold text-slate-700 block">Integration Architecture:</span>
                  <ul className="list-disc list-inside space-y-1 text-slate-600">
                    <li>Axios client configured with interceptors for auth tokens and normalized 401/403/422/500 errors.</li>
                    <li>Individual service files for each domain: Products, Plans, Customers, Subscriptions, Quotations, Invoices, Payments, Discounts.</li>
                    <li>Toggle <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">USE_MOCK = false</code> in <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">src/services/api.ts</code> to switch to live FastAPI endpoints.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Invite Staff */}
        <Modal
          isOpen={isAddStaffOpen}
          onClose={() => setIsAddStaffOpen(false)}
          title="Invite Team Staff Member"
          description="Grant an employee access to SteepX operational modules."
          maxWidth="md"
          footer={
            <>
              <button
                type="button"
                onClick={() => setIsAddStaffOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddStaffSubmit}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-xs"
              >
                Send Invite
              </button>
            </>
          }
        >
          <form onSubmit={handleAddStaffSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="e.g. Jordan Lee"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Company Email *</label>
              <input
                type="email"
                required
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="jordan.l@brightloop.io"
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Role Permissions</label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-900 font-medium"
              >
                <option value="STAFF">Staff (Operations, Invoices & Customer Subscriptions)</option>
                <option value="ADMIN">Admin (Full Workspace Management)</option>
              </select>
            </div>
          </form>
        </Modal>
      </div>
    </AppLayout>
  );
}


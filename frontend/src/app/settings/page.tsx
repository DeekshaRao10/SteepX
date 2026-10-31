"use client";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { RoleBadge } from "@/components/common/RoleBadge";
import { Modal } from "@/components/common/Modal";
import { useToast } from "@/context/ToastContext";
import { apiClient, listAll, errorMessage } from "@/services/api";
import { mapUser } from "@/services/auth.service";
import { UserResponse } from "@/types/api";
export default function SettingsPage() {
  const { toast } = useToast();
  const [staff, setStaff] = useState<UserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    listAll<UserResponse>("/staff").then(data => { if (active) setStaff(data); }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  async function create(event: React.FormEvent) {
    event.preventDefault(); if (saving) return; setSaving(true);
    try { await apiClient.post("/staff", { email, password }); setOpen(false); setEmail(""); setPassword(""); setError(""); setRevision(value => value + 1); toast.success("Staff account created. Share its credentials securely; no invitation email was sent."); }
    catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  }
  return <AppLayout allowedRoles={["ADMIN"]}><div className="space-y-6"><PageHeader title="Workspace Settings & Administration" description="Manage staff accounts for Brightloop Software." actions={<button onClick={() => { setOpen(true); setError(""); }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold">Add Staff</button>} />
    {error && !open && <p role="alert" className="text-rose-600">{error}<button className="ml-3 underline" onClick={() => { setError(""); setRevision(value => value + 1); }}>Retry</button></p>}
    <DataTable data={staff} isLoading={loading} searchFilterKeys={["email"]} columns={[{ header: "Email", cell: user => user.email }, { header: "Role", cell: user => <RoleBadge role={mapUser(user).role} /> }, { header: "Status", cell: user => user.is_active ? "Active" : "Inactive" }]} />
    <p className="text-xs text-slate-500">Administrators manage staff access, taxes, and discounts. Staff can manage catalog, customers, agreements, invoices, and manual payments.</p>
    <Modal isOpen={open} onClose={() => { if (!saving) { setOpen(false); setPassword(""); } }} title="Create Staff Account" description="New team members receive the Staff role." footer={<button type="submit" form="staff-form" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm">{saving ? "Creating?" : "Create Staff"}</button>}>
      {error && <p role="alert" className="mb-3 text-sm text-rose-600">{error}</p>}
      <form id="staff-form" onSubmit={create} className="space-y-4"><label className="block text-xs">Email<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="block w-full mt-1 border rounded-xl p-2 text-sm" /></label><label className="block text-xs">Initial password<input required type="password" autoComplete="new-password" minLength={9} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="block w-full mt-1 border rounded-xl p-2 text-sm" /></label><p className="text-xs text-slate-500">Use 9?128 characters with uppercase, lowercase, and a special character.</p></form>
    </Modal>
  </div></AppLayout>;
}

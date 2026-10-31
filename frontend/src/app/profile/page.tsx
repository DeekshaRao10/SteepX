"use client";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { useToast } from "@/context/ToastContext";
import { apiClient, errorMessage } from "@/services/api";
import { CustomerResponse } from "@/types/api";
export default function ProfilePage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<CustomerResponse>();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { apiClient.get<CustomerResponse>("/customers/me").then(({ data }) => setProfile(data)).catch(e => setError(errorMessage(e))); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!profile || saving) return; setSaving(true);
    try { const { display_name, company, phone, billing_address } = profile; const { data } = await apiClient.patch<CustomerResponse>("/customers/me", { display_name, company, phone, billing_address }); setProfile(data); setError(""); toast.success("Billing profile updated."); }
    catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  }
  return <AppLayout allowedRoles={["CUSTOMER"]}><div className="space-y-6"><PageHeader title="Billing Profile" description="Update the contact and billing details used for new invoices." />{error && <p role="alert" className="text-rose-600">{error}</p>}{profile ? <form id="form-save" onSubmit={save} className="max-w-xl space-y-4 p-6 bg-white border border-slate-200 rounded-2xl"><p className="text-sm text-slate-500">{profile.email}</p>{(["display_name", "company", "phone", "billing_address"] as const).map(field => <label key={field} className="block text-xs font-semibold capitalize">{field.replaceAll("_", " ")}<textarea required={field === "display_name"} maxLength={field === "billing_address" ? 2000 : field === "phone" ? 40 : 150} rows={field === "billing_address" ? 3 : 1} value={profile[field]} onChange={e => setProfile({ ...profile, [field]: e.target.value })} className="mt-1 block w-full border border-slate-200 rounded-xl p-2 text-sm" /></label>)}<button disabled={saving} className="px-4 py-2 bg-indigo-600 rounded-xl text-sm font-semibold text-white">{saving ? "Saving…" : "Save Profile"}</button></form> : !error && <p role="status">Loading billing profile…</p>}</div></AppLayout>;
}

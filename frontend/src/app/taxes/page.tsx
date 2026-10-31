"use client";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { taxService } from "@/services/discount.service";
import { errorMessage } from "@/services/api";
import { TaxResponse } from "@/types/api";
export default function TaxesPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [taxes, setTaxes] = useState<TaxResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TaxResponse>();
  const [name, setName] = useState("");
  const [rate, setRate] = useState("0");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    taxService.getAll().then(data => { if (alive) setTaxes(data); }).catch(e => { if (alive) setError(errorMessage(e)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [revision]);
  function edit(tax?: TaxResponse) { setEditing(tax); setName(tax?.name || ""); setRate(String(tax?.rate || 0)); setDescription(tax?.description || ""); setActive(tax?.is_active ?? true); setError(""); setOpen(true); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (saving) return; setSaving(true);
    try { await taxService.save({ name, rate, description, is_active: active }, editing?.id); setOpen(false); setRevision(value => value + 1); toast.success("Tax rate saved. Select it when creating or editing a plan."); }
    catch (e) { setError(errorMessage(e)); } finally { setSaving(false); }
  }
  const input = "block w-full p-2 border border-slate-200 rounded-xl bg-slate-50 text-sm";
  return <AppLayout allowedRoles={["ADMIN", "STAFF"]}><div className="space-y-6"><PageHeader title="Tax Rates" description="Manage tax rates assigned to subscription plans. Existing agreements retain their tax snapshots." actions={isAdmin && <button onClick={() => edit()} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl">New Tax Rate</button>} />
    {error && !open && <p role="alert" className="text-rose-600">{error}<button onClick={() => { setError(""); setRevision(value => value + 1); }} className="ml-3 underline">Retry</button></p>}
    <DataTable data={taxes} isLoading={loading} searchFilterKeys={["name"]} columns={[{ header: "Name", cell: t => t.name }, { header: "Rate", cell: t => `${t.rate}%` }, { header: "Description", cell: t => t.description }, { header: "Status", cell: t => <StatusBadge status={t.is_active ? "active" : "archived"} /> }, { header: "Actions", cell: t => isAdmin && <button onClick={() => edit(t)} className="text-indigo-600 text-xs font-semibold">Edit / Archive</button> }]} />
    <Modal isOpen={open} onClose={() => setOpen(false)} title={editing ? "Edit Tax Rate" : "Create Tax Rate"} footer={<button type="submit" form="tax-form" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm">Save Tax Rate</button>}>
      {error && <p role="alert" className="text-rose-600 text-sm mb-3">{error}</p>}
      <form id="tax-form" onSubmit={save} className="space-y-4"><label className="block text-xs">Name<input required maxLength={150} value={name} onChange={e => setName(e.target.value)} className={input} /></label><label className="block text-xs">Rate (%)<input required type="number" min={0} max={100} step="0.0001" value={rate} onChange={e => setRate(e.target.value)} className={input} /></label><label className="block text-xs">Description<textarea maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} className={input} /></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Active</label></form>
    </Modal>
  </div></AppLayout>;
}

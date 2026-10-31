"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { Subscription } from "@/types";
import { subscriptionService } from "@/services/subscription.service";
import { errorMessage, utcDate } from "@/services/api";
export function InvoiceGenerator({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selected, setSelected] = useState("");
  const [issueDate, setIssueDate] = useState(utcDate());
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    subscriptionService.getAll().then(data => {
      if (!active) return;
      const eligible = data.filter(s => ["active", "closed"].includes(s.status) && s.nextBillingDate <= utcDate() && (!s.endDate || s.nextBillingDate < s.endDate));
      setSubscriptions(eligible); setSelected(eligible[0]?.id || "");
    }).catch(e => { if (active) setError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (pending.current) return; pending.current = true; setSaving(true);
    try { await subscriptionService.generateInvoice(selected, subscriptions.find(s => s.id === selected)!.nextBillingDate, issueDate, dueDate); onSaved(); }
    catch (e) { setError(errorMessage(e)); }
    finally { pending.current = false; setSaving(false); }
  }
  const subscription = subscriptions.find(s => s.id === selected);
  const input = "block w-full p-2 rounded-xl border border-slate-200 bg-slate-50 text-sm";
  return <Modal isOpen onClose={saving ? () => {} : onClose} title="Generate Subscription Invoice" description="Bills the earliest unbilled period using the agreed prices, taxes, and eligible discount. Confirm the draft after reviewing it."
    footer={<button type="submit" form="generate-invoice" disabled={loading || saving || !selected} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl disabled:opacity-50">{saving ? "Generating…" : "Generate Draft"}</button>}>
    {error && <p role="alert" className="text-rose-600 text-sm mb-3">{error}</p>}
    {loading ? <p>Loading billable subscriptions…</p> : <form id="generate-invoice" onSubmit={submit} className="space-y-4">
      {!subscriptions.length && <p>No subscriptions have an unbilled period available today.</p>}
      <label className="block text-xs">Subscription<select required className={input} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select subscription</option>{subscriptions.map(s => <option key={s.id} value={s.id}>{s.subscriptionNumber} — {s.customerName} — {s.currency}</option>)}</select></label>
      {subscription && <p className="text-sm">Period starts: {subscription.nextBillingDate}</p>}
      <label className="block text-xs">Issue date<input required type="date" className={input} min={subscription?.nextBillingDate} max={utcDate()} value={issueDate} onChange={e => setIssueDate(e.target.value)} /></label>
      <label className="block text-xs">Due date (optional)<input type="date" className={input} min={issueDate} value={dueDate} onChange={e => setDueDate(e.target.value)} /></label>
    </form>}
  </Modal>;
}

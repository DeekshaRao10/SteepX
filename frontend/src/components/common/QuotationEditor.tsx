"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { useAuth } from "@/context/AuthContext";
import { Customer, SubscriptionPlan, Quotation } from "@/types";
import { LineSelection, TemplateResponse, VariantResponse } from "@/types/api";
import { customerService } from "@/services/customer.service";
import { planService } from "@/services/plan.service";
import { productService } from "@/services/product.service";
import { quotationService } from "@/services/quotation.service";
import { errorMessage, utcDate } from "@/services/api";
import { formatCurrency } from "@/lib/utils";

const input = "w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900";
export function QuotationEditor({ onClose, onSaved }: { onClose: () => void; onSaved: (quote: Quotation) => void }) {
  const { isCustomer } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [variants, setVariants] = useState<Record<string, VariantResponse[]>>({});
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<LineSelection[]>([]);
  const [startDate, setStartDate] = useState(utcDate());
  const [endDate, setEndDate] = useState("");
  const [validUntil, setValidUntil] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [cs, ps, ts] = await Promise.all([customerService.getAll(), planService.getAll(), quotationService.templates()]);
        const available = ps.filter(p => p.status === "active");
        const entries = await Promise.all([...new Set(available.map(p => p.productId))].map(async id => [id, await productService.getVariants(id)] as const));
        if (!active) return;
        setCustomers(cs.filter(c => c.status === "active")); setCustomerId(cs.find(c => c.status === "active")?.id || "");
        setPlans(available); setTemplates(ts.filter(t => t.is_active)); setVariants(Object.fromEntries(entries));
        setLines(available.length ? [{ plan_id: available[0].id, quantity: available[0].minimumQuantity, variant_ids: [] }] : []);
        setError("");
      } catch (e) { if (active) setError(errorMessage(e)); }
      finally { if (active) setLoading(false); }
    }
    void load(); return () => { active = false; };
  }, [retry]);
  const changeLine = (index: number, update: Partial<LineSelection>) => setLines(previous => previous.map((line, i) => i === index ? { ...line, ...update } : line));
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setSaving(true); setError("");
    try {
      const quote = await quotationService.create({ customerId, customerName: "", customerEmail: "", status: "draft",
        items: lines.map((line, index) => ({ id: String(index), planId: line.plan_id, quantity: line.quantity || 1, variantIds: line.variant_ids,
          description: "", unitPrice: 0, discountAmount: 0, total: 0 })),
        startDate, endDate, validityDate: validUntil, discountCode: discount, notes,
        subtotal: 0, taxRate: 0, taxAmount: 0, discountAmount: 0, totalAmount: 0 });
      onSaved(quote);
    } catch (e) { setError(errorMessage(e)); }
    finally { pending.current = false; setSaving(false); }
  }
  async function saveTemplate() {
    if (pending.current || !templateName.trim()) return;
    pending.current = true; setSaving(true);
    try {
      const template = await quotationService.saveTemplate({ name: templateName, notes, selections: lines, validity_days: 30, is_active: true });
      setTemplates(previous => [template, ...previous]); setTemplateName(""); setError("");
    } catch (e) { setError(errorMessage(e)); }
    finally { pending.current = false; setSaving(false); }
  }
  return <Modal isOpen onClose={saving ? () => {} : onClose} title="Create Commercial Quotation" description="Choose plans and options. Review the calculated quotation before issuing or accepting it." maxWidth="2xl"
    footer={<><button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm">Cancel</button><button type="submit" form="quotation-form" disabled={saving || loading || !lines.length || !customerId} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-xl disabled:opacity-50">{saving ? "Saving…" : "Calculate & Save Draft"}</button></>}>
    {error && <div role="alert" className="mb-4 p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">{error}{loading || !plans.length ? <button className="ml-3 underline" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Retry</button> : null}</div>}
    {loading ? <p role="status">Loading available plans…</p> : <form id="quotation-form" onSubmit={save} className="space-y-4">
      {!plans.length && <p>No available plans. Ask an administrator to publish a plan.</p>}
      {!isCustomer && <label className="block text-xs font-medium">Customer<select required className={input} value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">Select customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}</select></label>}
      {!!templates.length && <label className="block text-xs font-medium">Start from a template<select defaultValue="" className={input} onChange={e => { const template = templates.find(t => t.id === e.target.value); if (template) { setLines(template.selections); setNotes(template.notes || ""); } }}><option value="">Choose a template</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
      <div className="grid sm:grid-cols-3 gap-3"><label className="text-xs">Start date<input required type="date" min={isCustomer ? utcDate() : undefined} className={input} value={startDate} onChange={e => setStartDate(e.target.value)} /></label><label className="text-xs">End date (optional)<input type="date" min={startDate} className={input} value={endDate} onChange={e => setEndDate(e.target.value)} /></label><label className="text-xs">Valid until<input required type="date" min={utcDate()} className={input} value={validUntil} onChange={e => setValidUntil(e.target.value)} /></label></div>
      {lines.map((line, index) => {
        const plan = plans.find(p => p.id === line.plan_id);
        const options = (variants[plan?.productId || ""] || []).filter(v => v.is_active);
        return <div key={index} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex gap-3"><label className="text-xs flex-1">Plan<select required className={input} value={line.plan_id} onChange={e => changeLine(index, { plan_id: e.target.value, quantity: plans.find(p => p.id === e.target.value)?.minimumQuantity || 1, variant_ids: [] })}>{!plan && <option value="">Choose an available plan</option>}{plans.map(p => <option key={p.id} value={p.id}>{p.productName} / {p.name} — {formatCurrency(p.price, p.currency)} / {p.billingInterval}</option>)}</select></label><label className="text-xs w-24">Quantity<input required type="number" min={plan?.minimumQuantity || 1} max={10000} step={1} className={input} value={line.quantity} onChange={e => changeLine(index, { quantity: Number(e.target.value) })} /></label></div>
          {!!options.filter(v => v.kind === "variant").length && <label className="block text-xs">Variant<select className={input} value={(line.variant_ids || []).find(id => options.some(v => v.id === id && v.kind === "variant")) || ""} onChange={e => changeLine(index, { variant_ids: [...(line.variant_ids || []).filter(id => !options.some(v => v.id === id && v.kind === "variant")), ...(e.target.value ? [e.target.value] : [])] })}><option value="">Base product</option>{options.filter(v => v.kind === "variant").map(v => <option key={v.id} value={v.id}>{v.name} (+{formatCurrency(Number(v.additional_price), plan?.currency)} per unit)</option>)}</select></label>}
          {options.filter(v => v.kind === "addon").map(v => <label key={v.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={(line.variant_ids || []).includes(v.id)} onChange={e => changeLine(index, { variant_ids: e.target.checked ? [...(line.variant_ids || []), v.id] : (line.variant_ids || []).filter(id => id !== v.id) })} />{v.name} (+{formatCurrency(Number(v.additional_price), plan?.currency)} per unit)</label>)}
          {lines.length > 1 && <button type="button" className="text-xs text-rose-600" onClick={() => setLines(previous => previous.filter((_, i) => i !== index))}>Remove line</button>}
        </div>;
      })}
      {!!plans.length && <button type="button" disabled={lines.length >= 50} className="text-sm font-semibold text-indigo-600" onClick={() => setLines(previous => [...previous, { plan_id: plans[0].id, quantity: plans[0].minimumQuantity, variant_ids: [] }])}>+ Add line</button>}
      <p className="text-xs text-slate-500">All lines must use the same currency, billing interval, and end behavior. Tax follows each plan; discounts are checked when the quote is saved.</p>
      <label className="block text-xs">Discount code (optional)<input className={input} maxLength={40} value={discount} onChange={e => setDiscount(e.target.value.toUpperCase())} /></label>
      <label className="block text-xs">Notes<textarea className={input} maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} /></label>
      {!isCustomer && <div className="flex gap-2 pt-3 border-t"><input className={input} placeholder="Optional template name" value={templateName} onChange={e => setTemplateName(e.target.value)} maxLength={150} /><button type="button" disabled={saving || !templateName.trim() || !lines.length} className="text-xs text-indigo-600 disabled:opacity-50" onClick={saveTemplate}>Save as template</button></div>}
    </form>}
  </Modal>;
}

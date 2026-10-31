"use client";
import { useEffect, useState } from "react";
import { VariantResponse, VariantWrite } from "@/types/api";
import { productService } from "@/services/product.service";
import { errorMessage } from "@/services/api";
import { formatCurrency } from "@/lib/utils";
export function VariantManager({ productId, currency, onChanged }: { productId: string; currency?: string; onChanged: () => void }) {
  const [items, setItems] = useState<VariantResponse[]>([]);
  const [editing, setEditing] = useState<string>();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"variant" | "addon">("variant");
  const [price, setPrice] = useState("0");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    productService.getVariants(productId).then(values => { if (alive) setItems(values); }).catch(e => { if (alive) setError(errorMessage(e)); });
    return () => { alive = false; };
  }, [productId, revision]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (saving) return; setSaving(true);
    try { const data: VariantWrite = { name, kind, additional_price: price, is_active: active }; await productService.saveVariant(productId, data, editing); setName(""); setPrice("0"); setEditing(undefined); setActive(true); setError(""); setRevision(value => value + 1); onChanged(); }
    catch (error) { setError(errorMessage(error)); } finally { setSaving(false); }
  }
  return <section className="space-y-3 border-t border-slate-200 pt-4"><h3 className="text-sm font-bold text-slate-800">Manage Variants & Add-ons</h3>
    {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
    {!items.length && <p className="text-xs text-slate-500">No variants or add-ons yet.</p>}
    {items.map(item => <div key={item.id} className="flex justify-between gap-2 text-xs p-2 rounded-lg bg-slate-50"><span>{item.name} ({item.kind}) — {formatCurrency(Number(item.additional_price), currency)} {item.is_active ? "" : "· Archived"}</span><button className="text-indigo-600" onClick={() => { setEditing(item.id); setName(item.name); setKind(item.kind); setPrice(String(item.additional_price)); setActive(item.is_active ?? true); }}>Edit</button></div>)}
    <form onSubmit={save} className="space-y-3"><div className="grid grid-cols-2 gap-2"><label className="text-xs">Name<input required maxLength={150} value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-lg p-2" /></label><label className="text-xs">Type<select value={kind} onChange={e => setKind(e.target.value as "variant" | "addon")} className="w-full border rounded-lg p-2"><option value="variant">Variant</option><option value="addon">Add-on</option></select></label><label className="text-xs">Additional price per unit<input required type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="w-full border rounded-lg p-2" /></label><label className="text-xs flex items-center gap-2"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Active</label></div><button disabled={saving} className="px-3 py-2 text-xs bg-indigo-600 text-white rounded-xl">{saving ? "Saving…" : editing ? "Save Changes" : "Add Option"}</button>{editing && <button type="button" className="ml-3 text-xs" onClick={() => { setEditing(undefined); setName(""); setPrice("0"); setActive(true); }}>Cancel Edit</button>}</form>
  </section>;
}

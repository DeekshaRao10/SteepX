"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { RoleBadge } from "@/components/common/RoleBadge";
import { invoiceService } from "@/services/invoice.service";
import { Invoice } from "@/types";
import { Menu, Bell, LogOut, ChevronDown, Settings, Plus } from "lucide-react";
import Link from "next/link";
export function Navbar({ onOpenMobileSidebar }: { onOpenMobileSidebar: () => void }) {
  const { user, role, logout, isCustomer } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [overdue, setOverdue] = useState<Invoice[]>([]);
  const [notificationError, setNotificationError] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (container.current && !container.current.contains(event.target as Node)) { setProfileOpen(false); setNotificationsOpen(false); } };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    if (!notificationsOpen) return;
    let active = true;
    invoiceService.getAll().then(items => { if (active) { setOverdue(items.filter(i => i.status === "overdue")); setNotificationError(false); } }).catch(() => { if (active) setNotificationError(true); });
    return () => { active = false; };
  }, [notificationsOpen]);
  return <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
    <div className="flex items-center gap-3"><button onClick={onOpenMobileSidebar} aria-label="Open sidebar menu" className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100"><Menu className="w-5 h-5" /></button><span className="hidden sm:block text-sm font-semibold text-slate-600">Brightloop Software</span></div>
    <div ref={container} className="flex items-center gap-3"><RoleBadge role={role} /><Link href="/quotations" className="hidden sm:flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl"><Plus className="w-4 h-4" />New Quotation</Link>
      <div className="relative"><button aria-label="Invoice notifications" onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }} className="p-2 text-slate-500 rounded-xl hover:bg-slate-100"><Bell className="w-5 h-5" /></button>
        {notificationsOpen && <div className="absolute right-0 mt-3 w-72 bg-white border rounded-2xl shadow-xl p-4 text-xs"><h3 className="font-bold mb-3">Overdue invoices</h3>{notificationError ? <p>Could not load notifications. Reopen to retry.</p> : overdue.length ? overdue.slice(0, 5).map(i => <Link key={i.id} href="/invoices" onClick={() => setNotificationsOpen(false)} className="block py-2 border-b border-slate-100">{i.invoiceNumber} ? {i.customerName}</Link>) : <p className="text-slate-500">No overdue invoices.</p>}</div>}
      </div>
      <div className="relative"><button onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }} className="flex items-center gap-2 text-left"><span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">{user?.name.slice(0, 1).toUpperCase()}</span><span className="hidden md:block text-xs font-semibold text-slate-900">{user?.name}</span><ChevronDown className="w-4 h-4 text-slate-400" /></button>
        {profileOpen && <div className="absolute right-0 mt-3 w-60 bg-white border rounded-2xl shadow-xl py-2 text-xs"><div className="px-4 py-3 border-b"><p className="font-bold">{user?.name}</p><p className="truncate text-slate-500">{user?.email}</p></div>{role === "ADMIN" && <Link href="/settings" className="flex gap-2 px-4 py-3 hover:bg-slate-50"><Settings className="w-4 h-4" />Workspace Settings</Link>}{isCustomer && <Link href="/profile" className="block px-4 py-3 hover:bg-slate-50">Billing Profile</Link>}<button onClick={() => { setProfileOpen(false); void logout(); }} className="w-full flex gap-2 px-4 py-3 text-rose-600 hover:bg-rose-50"><LogOut className="w-4 h-4" />Sign out</button></div>}
      </div>
    </div>
  </header>;
}

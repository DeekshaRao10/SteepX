"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@/types";
import {
  LayoutDashboard,
  Package,
  CalendarDays,
  Users,
  Repeat,
  FileSpreadsheet,
  Receipt,
  Percent,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  Sparkles,
  Layers,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
  badge?: string;
  category?: string;
}

const NAV_ITEMS: NavItem[] = [
  // CORE
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "STAFF", "CUSTOMER"], category: "Overview" },
  
  // CUSTOMER PORTAL SPECIFIC
  { name: "My Subscriptions", href: "/subscriptions", icon: Repeat, roles: ["CUSTOMER"], category: "Account" },
  { name: "My Invoices", href: "/invoices", icon: Receipt, roles: ["CUSTOMER"], category: "Account" },
  { name: "Payment History", href: "/payments", icon: CreditCard, roles: ["CUSTOMER"], category: "Account" },

  // ADMIN & STAFF OPERATIONS
  { name: "Customers", href: "/customers", icon: Users, roles: ["ADMIN", "STAFF"], category: "Relationships" },
  { name: "Subscriptions", href: "/subscriptions", icon: Repeat, roles: ["ADMIN", "STAFF"], category: "Subscriptions & Billing" },
  { name: "Quotations", href: "/quotations", icon: FileSpreadsheet, roles: ["ADMIN", "STAFF"], category: "Subscriptions & Billing" },
  { name: "Invoices", href: "/invoices", icon: Receipt, roles: ["ADMIN", "STAFF"], category: "Subscriptions & Billing" },
  { name: "Payments & Finance", href: "/payments", icon: CreditCard, roles: ["ADMIN", "STAFF"], category: "Subscriptions & Billing" },

  // CATALOG & MARKETING
  { name: "Products", href: "/products", icon: Package, roles: ["ADMIN", "STAFF"], category: "Product Catalog" },
  { name: "Subscription Plans", href: "/plans", icon: CalendarDays, roles: ["ADMIN", "STAFF"], category: "Product Catalog" },
  { name: "Discounts", href: "/discounts", icon: Percent, roles: ["ADMIN", "STAFF"], category: "Product Catalog" },

  // ADMIN SETTINGS
  { name: "Settings & Team", href: "/settings", icon: Settings, roles: ["ADMIN"], category: "Administration" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();

  // Filter items by active role
  const permittedItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  // Group items by category
  const categories = Array.from(new Set(permittedItems.map((i) => i.category || "General")));

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ease-in-out lg:static ${
          collapsed ? "w-20" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="font-extrabold text-lg tracking-tight text-slate-900 leading-none flex items-center gap-1.5">
                  SteepX
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                    SaaS
                  </span>
                </span>
                <span className="text-[11px] text-slate-400 font-medium tracking-tight truncate mt-0.5">
                  by Brightloop
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:flex w-7 h-7 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 items-center justify-center transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {categories.map((category) => {
            const items = permittedItems.filter((i) => (i.category || "General") === category);
            if (items.length === 0) return null;

            return (
              <div key={category} className="space-y-1">
                {!collapsed && (
                  <h4 className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    {category}
                  </h4>
                )}
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onCloseMobile}
                      title={collapsed ? item.name : undefined}
                      className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                        isActive
                          ? "bg-indigo-50/80 text-indigo-600 font-semibold shadow-xs"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      } ${collapsed ? "justify-center px-0" : ""}`}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 transition-colors ${
                          isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* User Card & Logout Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : "px-2 py-1.5"}`}>
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
              {user?.name?.charAt(0) || "U"}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{user?.name || "Alex Vance"}</p>
                <p className="text-[10px] text-slate-500 truncate">{role}</p>
              </div>
            )}
            <button
              onClick={() => logout()}
              title="Logout"
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}


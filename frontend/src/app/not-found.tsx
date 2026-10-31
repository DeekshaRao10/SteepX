"use client";

import React from "react";
import Link from "next/link";
import { Layers, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 shadow-sm border border-indigo-100">
        <Layers className="w-7 h-7" />
      </div>
      <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
        404 Error
      </span>
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">
        Page Not Found
      </h1>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        The requested subscription resource, invoice, or dashboard view could not be located on this server.
      </p>
      <Link
        href="/dashboard"
        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors inline-flex items-center gap-2 shadow-xs"
      >
        <ArrowLeft className="w-4 h-4" />
        Return to Dashboard
      </Link>
    </div>
  );
}


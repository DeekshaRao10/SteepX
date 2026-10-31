import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: number;
  changePeriod?: string;
  subtitle?: string;
  accentColor?: string;
}

export function StatCard({
  title,
  value,
  icon,
  change,
  changePeriod = "vs last month",
  subtitle,
}: StatCardProps) {
  const isPositive = change !== undefined ? change >= 0 : undefined;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
          {icon}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{value}</div>

        {(change !== undefined || subtitle) && (
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            {change !== undefined && (
              <span
                className={`inline-flex items-center font-medium ${
                  isPositive ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {isPositive ? (
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                )}
                {Math.abs(change)}%
              </span>
            )}
            <span className="text-slate-400">{changePeriod || subtitle}</span>
          </div>
        )}
      </div>
    </div>
  );
}


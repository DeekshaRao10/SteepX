import React from "react";

export function LoadingSkeleton({ className = "h-6 w-full" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-md ${className}`}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 overflow-hidden p-4 space-y-4">
      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
        <LoadingSkeleton className="h-8 w-48" />
        <LoadingSkeleton className="h-8 w-32" />
      </div>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div key={rIdx} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <LoadingSkeleton key={cIdx} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <div className="flex justify-between items-center">
        <LoadingSkeleton className="h-4 w-24" />
        <LoadingSkeleton className="h-8 w-8 rounded-lg" />
      </div>
      <LoadingSkeleton className="h-8 w-32" />
      <LoadingSkeleton className="h-4 w-20" />
    </div>
  );
}


import { cn as baseCn } from "cn";

export function cn(...inputs: Parameters<typeof baseCn>) {
  return baseCn(...inputs);
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string | Date): string {
  if (!dateStr) return "-";
  const date = typeof dateStr === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + "T00:00:00" : dateStr) : dateStr;
  if (isNaN(date.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(dateStr: string | Date): string {
  if (!dateStr) return "-";
  const date = typeof dateStr === "string" ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr + "T00:00:00" : dateStr) : dateStr;
  if (isNaN(date.getTime())) return String(dateStr);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function generateId(prefix: string = "ID"): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${timestamp}${randomNum}`;
}

export function getStatusColor(status: string): { bg: string; text: string; border: string; dot: string } {
  const s = status.toLowerCase();
  switch (s) {
    case "active":
    case "paid":
    case "completed":
    case "accepted":
      return {
        bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        text: "text-emerald-700 dark:text-emerald-300",
        border: "border-emerald-200 dark:border-emerald-800",
        dot: "bg-emerald-500",
      };
    case "confirmed":
    case "sent":
    case "converted":
      return {
        bg: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
        text: "text-blue-700 dark:text-blue-300",
        border: "border-blue-200 dark:border-blue-800",
        dot: "bg-blue-500",
      };
    case "quotation":
    case "pending":
    case "partially_paid":
      return {
        bg: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
        text: "text-amber-700 dark:text-amber-300",
        border: "border-amber-200 dark:border-amber-800",
        dot: "bg-amber-500",
      };
    case "draft":
    case "inactive":
    case "paused":
      return {
        bg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        text: "text-slate-700 dark:text-slate-300",
        border: "border-slate-200 dark:border-slate-700",
        dot: "bg-slate-400",
      };
    case "overdue":
    case "failed":
    case "cancelled":
    case "closed":
    case "rejected":
    case "suspended":
    case "expired":
      return {
        bg: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
        text: "text-rose-700 dark:text-rose-300",
        border: "border-rose-200 dark:border-rose-800",
        dot: "bg-rose-500",
      };
    case "unpaid":
      return {
        bg: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
        text: "text-orange-700 dark:text-orange-300",
        border: "border-orange-200 dark:border-orange-800",
        dot: "bg-orange-500",
      };
    default:
      return {
        bg: "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
        text: "text-slate-700 dark:text-slate-300",
        border: "border-slate-200 dark:border-slate-700",
        dot: "bg-slate-400",
      };
  }
}

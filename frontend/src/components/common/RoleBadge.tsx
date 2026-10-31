import React from "react";
import { UserRole } from "@/types";
import { Shield, UserCheck, Users } from "lucide-react";

interface RoleBadgeProps {
  role: UserRole;
  showIcon?: boolean;
}

export function RoleBadge({ role, showIcon = true }: RoleBadgeProps) {
  let badgeStyle = "bg-indigo-50 text-indigo-700 border-indigo-200";
  let Icon = Shield;

  if (role === "STAFF") {
    badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
    Icon = UserCheck;
  } else if (role === "CUSTOMER") {
    badgeStyle = "bg-sky-50 text-sky-700 border-sky-200";
    Icon = Users;
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold ${badgeStyle}`}>
      {showIcon && <Icon className="w-3 h-3" />}
      <span>{role}</span>
    </span>
  );
}


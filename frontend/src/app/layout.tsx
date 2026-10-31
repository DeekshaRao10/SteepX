import type { Metadata } from "next";
import "./globals.css";
import "./tailwind-built.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";

export const metadata: Metadata = {
  title: "SteepX | Subscription Management & Billing Platform",
  description: "Enterprise SaaS subscription management and recurring billing platform by Brightloop Software.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased light">
      <head>
        <link rel="stylesheet" href="/compiled-tailwind.css" />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900 selection:bg-indigo-600 selection:text-white">
        <ToastProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

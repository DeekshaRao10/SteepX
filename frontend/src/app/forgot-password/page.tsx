import Link from "next/link";
export default function ForgotPasswordPage() {
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6"><div className="max-w-md bg-white border border-slate-200 rounded-2xl p-8 shadow-xl"><h1 className="text-xl font-bold text-slate-900">Account recovery</h1><p className="my-4 text-sm text-slate-600">Email password recovery is not configured for this installation. Contact your Brightloop administrator for account assistance.</p><Link href="/login" className="text-sm font-semibold text-indigo-600">Back to sign in</Link></div></div>;
}

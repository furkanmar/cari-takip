"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, fetchMe, logout } = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.replace("/login"); return; }
    fetchMe();
  }, []);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CT</span>
            </div>
            <span className="font-bold text-slate-800 text-lg">Cari Takip</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 hidden sm:block">{user?.email}</span>
            <button
              onClick={logout}
              className="text-sm font-medium text-slate-600 hover:text-red-600 transition-colors border border-slate-200 rounded-lg px-3 py-1.5 hover:border-red-200"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

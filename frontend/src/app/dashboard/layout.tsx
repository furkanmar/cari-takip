"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, fetchMe, logout } = useAuthStore();

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) { router.replace("/login"); return; }
    fetchMe();
  }, []);

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg text-blue-600">Cari Takip</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.fullName}</span>
          <button
            onClick={logout}
            className="text-sm text-red-500 hover:text-red-700 font-medium"
          >
            Çıkış
          </button>
        </div>
      </header>
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">{children}</main>
    </div>
  );
}

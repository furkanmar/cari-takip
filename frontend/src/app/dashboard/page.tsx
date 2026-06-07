"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface Company {
  id: string;
  name: string;
  taxNumber: string;
  phone: string;
  totalReceivable: string;
  totalPayable: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", taxNumber: "", phone: "", email: "", address: "" });
  const [saving, setSaving] = useState(false);

  const fetchCompanies = async () => {
    const res = await api.get("/companies");
    setCompanies(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchCompanies(); }, []);

  const totalReceivable = companies.reduce((s, c) => s + parseFloat(c.totalReceivable || "0"), 0);
  const totalPayable = companies.reduce((s, c) => s + parseFloat(c.totalPayable || "0"), 0);
  const netBalance = totalReceivable - totalPayable;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/companies", form);
      setForm({ name: "", taxNumber: "", phone: "", email: "", address: "" });
      setShowForm(false);
      fetchCompanies();
    } finally {
      setSaving(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

  if (loading) return <div className="flex justify-center mt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;

  return (
    <div className="space-y-6">
      {/* Genel özet */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-xs text-gray-500 mb-1">Toplam Alacak</p>
          <p className="text-2xl font-bold text-green-600">{fmt(totalReceivable)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-xs text-gray-500 mb-1">Toplam Verecek</p>
          <p className="text-2xl font-bold text-red-500">{fmt(totalPayable)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-xs text-gray-500 mb-1">Net Bakiye</p>
          <p className={`text-2xl font-bold ${netBalance >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {fmt(netBalance)}
          </p>
        </div>
      </div>

      {/* Şirket listesi */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold">Şirketler</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition"
          >
            + Şirket Ekle
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="px-6 py-4 border-b bg-gray-50 grid grid-cols-2 gap-3">
            <input required placeholder="Şirket Adı *" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input placeholder="Vergi No" value={form.taxNumber}
              onChange={e => setForm({ ...form, taxNumber: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input placeholder="Telefon" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input placeholder="E-posta" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input placeholder="Adres" value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="text-sm px-4 py-1.5 border rounded-lg hover:bg-gray-100 transition">İptal</button>
              <button type="submit" disabled={saving}
                className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        )}

        {companies.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">Henüz şirket eklenmemiş.</p>
        ) : (
          <div className="divide-y">
            {companies.map((c) => {
              const receivable = parseFloat(c.totalReceivable || "0");
              const payable = parseFloat(c.totalPayable || "0");
              const net = receivable - payable;
              return (
                <div
                  key={c.id}
                  onClick={() => router.push(`/dashboard/companies/${c.id}`)}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 cursor-pointer transition"
                >
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.taxNumber || c.phone || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${net >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {fmt(net)}
                    </p>
                    <p className="text-xs text-gray-400">
                      A: {fmt(receivable)} / V: {fmt(payable)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

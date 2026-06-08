"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

interface Company {
  id: string;
  name: string;
  taxNumber: string;
  phone: string;
  email: string;
  address: string;
  totalReceivable: string;
  totalPayable: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const emptyForm = () => ({ name: "", taxNumber: "", phone: "", email: "", address: "" });

export default function DashboardPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchCompanies = async () => {
    const res = await api.get("/companies");
    setCompanies(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchCompanies(); }, []);

  const totalReceivable = companies.reduce((s, c) => s + parseFloat(c.totalReceivable || "0"), 0);
  const totalPayable = companies.reduce((s, c) => s + parseFloat(c.totalPayable || "0"), 0);
  const netBalance = totalReceivable - totalPayable;

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError("");
    setShowForm(true);
  };

  const openEdit = (e: React.MouseEvent, c: Company) => {
    e.stopPropagation();
    setEditingId(c.id);
    setForm({ name: c.name, taxNumber: c.taxNumber || "", phone: c.phone || "", email: c.email || "", address: c.address || "" });
    setError("");
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setError(""); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (editingId) {
        await api.put(`/companies/${editingId}`, form);
      } else {
        await api.post("/companies", form);
      }
      closeForm();
      fetchCompanies();
    } catch (err: any) {
      setError(err.response?.data?.message || "Hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center mt-32">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Özet kartlar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Toplam Alınan</p>
          <p className="text-3xl font-bold text-emerald-600">₺{fmt(totalReceivable)}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Toplam Verilen</p>
          <p className="text-3xl font-bold text-red-500">₺{fmt(totalPayable)}</p>
        </div>
        <div className={`rounded-2xl p-6 border shadow-sm ${netBalance >= 0 ? "bg-blue-600 border-blue-700" : "bg-red-600 border-red-700"}`}>
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">Net Bakiye</p>
          <p className="text-3xl font-bold text-white">₺{fmt(Math.abs(netBalance))}</p>
          <p className="text-xs text-white/70 mt-1">{netBalance >= 0 ? "Alacaklısın" : "Vereceksin"}</p>
        </div>
      </div>

      {/* Şirket listesi */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Şirketler</h2>
            <p className="text-sm text-slate-400">{companies.length} kayıt</p>
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
            <span className="text-lg leading-none">+</span> Şirket Ekle
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="px-6 py-5 bg-slate-50 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700 mb-3">{editingId ? "✏️ Şirketi Düzenle" : "➕ Yeni Şirket"}</p>
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required placeholder="Şirket Adı *"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="sm:col-span-2 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              <input placeholder="Vergi No"
                value={form.taxNumber} onChange={e => setForm({ ...form, taxNumber: e.target.value })}
                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              <input placeholder="Telefon"
                value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              <input placeholder="E-posta"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              <input placeholder="Adres"
                value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
            </div>
            <div className="flex gap-2 justify-end mt-3">
              <button type="button" onClick={closeForm}
                className="text-sm px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition">İptal</button>
              <button type="submit" disabled={saving}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? "Kaydediliyor..." : editingId ? "Güncelle" : "Kaydet"}
              </button>
            </div>
          </form>
        )}

        {companies.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">🏢</p>
            <p className="text-slate-500 font-medium">Henüz şirket eklenmedi</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {companies.map((c) => {
              const receivable = parseFloat(c.totalReceivable || "0");
              const payable = parseFloat(c.totalPayable || "0");
              const net = receivable - payable;
              return (
                <div key={c.id} onClick={() => router.push(`/dashboard/companies/${c.id}`)}
                  className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 cursor-pointer transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
                      <span className="text-slate-500 group-hover:text-blue-600 font-bold text-sm transition-colors">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.taxNumber || c.phone || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-bold text-lg ${net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {net >= 0 ? "+" : "-"}₺{fmt(Math.abs(net))}
                      </p>
                      <p className="text-xs text-slate-400">
                        Al: ₺{fmt(receivable)} · Ver: ₺{fmt(payable)}
                      </p>
                    </div>
                    <button onClick={(e) => openEdit(e, c)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50">
                      ✏️
                    </button>
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

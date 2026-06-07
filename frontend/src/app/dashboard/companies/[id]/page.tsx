"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

interface Transaction {
  id: string;
  date: string;
  description: string;
  type: "receivable" | "payable";
  amount: string;
  runningBalance: string;
  invoiceUrl: string | null;
  invoiceFileName: string | null;
}

interface Company {
  id: string;
  name: string;
  totalReceivable: string;
  totalPayable: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const emptyForm = () => ({
  date: new Date().toISOString().split("T")[0],
  description: "",
  type: "receivable" as "receivable" | "payable",
  amount: "",
});

export default function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [invoice, setInvoice] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchData = async () => {
    const [comp, txns] = await Promise.all([
      api.get(`/companies/${id}`),
      api.get(`/transactions?companyId=${id}`),
    ]);
    setCompany(comp.data);
    setTransactions(txns.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setInvoice(null);
    setError("");
    setShowForm(true);
  };

  const openEdit = (t: Transaction) => {
    setEditingId(t.id);
    setForm({ date: t.date, description: t.description, type: t.type, amount: t.amount });
    setInvoice(null);
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
        await api.put(`/transactions/${editingId}`, {
          date: form.date,
          description: form.description,
          type: form.type,
          amount: parseFloat(form.amount),
        });
      } else {
        const formData = new FormData();
        formData.append("companyId", id);
        formData.append("date", form.date);
        formData.append("description", form.description);
        formData.append("type", form.type);
        formData.append("amount", form.amount);
        if (invoice) formData.append("invoice", invoice);
        await api.post("/transactions", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      closeForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (txId: string) => {
    if (!confirm("Bu işlemi silmek istediğinize emin misiniz?")) return;
    await api.delete(`/transactions/${txId}`);
    fetchData();
  };

  if (loading) return (
    <div className="flex justify-center mt-32">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent" />
    </div>
  );
  if (!company) return null;

  const receivable = parseFloat(company.totalReceivable || "0");
  const payable = parseFloat(company.totalPayable || "0");
  const net = receivable - payable;

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors text-lg">
          ←
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{company.name}</h1>
          <p className="text-sm text-slate-400">{transactions.length} işlem</p>
        </div>
      </div>

      {/* Bakiye kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Alacak</p>
          <p className="text-2xl font-bold text-emerald-600">₺{fmt(receivable)}</p>
          <p className="text-xs text-slate-400 mt-1">Bu şirketten alacak</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Verecek</p>
          <p className="text-2xl font-bold text-red-500">₺{fmt(payable)}</p>
          <p className="text-xs text-slate-400 mt-1">Bu şirkete verecek</p>
        </div>
        <div className={`rounded-2xl p-6 border shadow-sm ${net >= 0 ? "bg-blue-600 border-blue-700" : "bg-red-600 border-red-700"}`}>
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">Net Bakiye</p>
          <p className="text-2xl font-bold text-white">₺{fmt(Math.abs(net))}</p>
          <p className="text-xs text-white/70 mt-1">{net >= 0 ? "Alacaklısın" : "Vereceksin"}</p>
        </div>
      </div>

      {/* İşlemler tablosu */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-lg">İşlem Geçmişi</h2>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
            <span className="text-lg leading-none">+</span> İşlem Ekle
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="px-6 py-5 bg-slate-50 border-b border-slate-100 space-y-3">
            <p className="text-sm font-semibold text-slate-700">{editingId ? "✏️ İşlemi Düzenle" : "➕ Yeni İşlem"}</p>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Tarih</label>
                <input type="date" required value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">İşlem Türü</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="receivable">📈 Alacak — bize borçlu</option>
                  <option value="payable">📉 Verecek — biz borçluyuz</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Açıklama</label>
                <input required placeholder="İşlem açıklaması..." value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Tutar (₺)</label>
                <input type="number" required min="0.01" step="0.01" placeholder="0.00" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {!editingId && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1.5">Fatura (opsiyonel)</label>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setInvoice(e.target.files?.[0] || null)}
                    className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-600 file:text-xs file:font-semibold hover:file:bg-slate-200" />
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={closeForm}
                className="text-sm px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 transition">İptal</button>
              <button type="submit" disabled={saving}
                className="text-sm bg-blue-600 text-white px-5 py-2 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? "Kaydediliyor..." : editingId ? "Güncelle" : "Kaydet"}
              </button>
            </div>
          </form>
        )}

        {transactions.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-slate-500 font-medium">Henüz işlem eklenmedi</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Tarih</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Açıklama</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Alacak</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Verecek</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Bakiye</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Fatura</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transactions.map((t) => {
                  const balance = parseFloat(t.runningBalance);
                  const amount = parseFloat(t.amount);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap font-medium">{t.date}</td>
                      <td className="px-6 py-4 text-sm text-slate-700">{t.description}</td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-600">
                        {t.type === "receivable" ? `+₺${fmt(amount)}` : ""}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-red-500">
                        {t.type === "payable" ? `-₺${fmt(amount)}` : ""}
                      </td>
                      <td className={`px-6 py-4 text-right text-sm font-bold ${balance >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {balance >= 0 ? "+" : ""}₺{fmt(balance)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {t.invoiceUrl ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 rounded-lg px-2 py-1">
                            📎 {t.invoiceFileName}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => openEdit(t)}
                            className="text-xs text-slate-400 hover:text-blue-500 transition-colors font-medium">
                            Düzenle
                          </button>
                          <button onClick={() => handleDelete(t.id)}
                            className="text-xs text-slate-300 hover:text-red-500 transition-colors font-medium">
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

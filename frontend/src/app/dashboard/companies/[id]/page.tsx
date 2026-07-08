"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";

interface Transaction {
  id: string;
  date: string;
  dueDate: string | null;
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

const today = () => new Date().toISOString().split("T")[0];

const emptyForm = () => ({
  date: today(),
  dueDate: "",
  description: "",
  type: "receivable" as "receivable" | "payable",
  amount: "",
});

const isOverdue = (dueDate: string | null) => {
  if (!dueDate) return false;
  return dueDate < today();
};

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

  // Filtreler
  const [filterType, setFilterType] = useState<"all" | "receivable" | "payable">("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

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

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterFrom && t.date < filterFrom) return false;
      if (filterTo && t.date > filterTo) return false;
      return true;
    });
  }, [transactions, filterType, filterFrom, filterTo]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setInvoice(null);
    setError("");
    setShowForm(true);
  };

  const openEdit = (t: Transaction) => {
    setEditingId(t.id);
    setForm({ date: t.date, dueDate: t.dueDate || "", description: t.description, type: t.type, amount: t.amount });
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
      const payload = { ...form, dueDate: form.dueDate || undefined };
      if (editingId) {
        await api.put(`/transactions/${editingId}`, { ...payload, amount: parseFloat(form.amount) });
      } else {
        const formData = new FormData();
        formData.append("companyId", id);
        formData.append("date", form.date);
        formData.append("description", form.description);
        formData.append("type", form.type);
        formData.append("amount", form.amount);
        if (form.dueDate) formData.append("dueDate", form.dueDate);
        if (invoice) formData.append("invoice", invoice);
        await api.post("/transactions", formData, { headers: { "Content-Type": "multipart/form-data" } });
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
  // net > 0 = biz borçluyuz (kırmızı), net <= 0 = kapatmışız (yeşil)
  const net = receivable - payable;
  const isDebt = net > 0;

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Borç +</p>
          <p className="text-2xl font-bold text-red-500">₺{fmt(receivable)}</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Borç -</p>
          <p className="text-2xl font-bold text-emerald-600">₺{fmt(payable)}</p>
        </div>
        <div className={`rounded-2xl p-6 border shadow-sm ${isDebt ? "bg-red-600 border-red-700" : "bg-emerald-600 border-emerald-700"}`}>
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-3">Net Borç</p>
          <p className="text-2xl font-bold text-white">₺{fmt(Math.abs(net))}</p>
          <p className="text-xs text-white/70 mt-1">{isDebt ? "Borçlusun" : "Kapatıldı"}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-lg">İşlem Geçmişi</h2>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors">
            <span className="text-lg leading-none">+</span> İşlem Ekle
          </button>
        </div>

        {/* Filtreler */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-semibold">
            {(["all", "receivable", "payable"] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 transition-colors ${filterType === t ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
                {t === "all" ? "Tümü" : t === "receivable" ? "Borç +" : "Borç -"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Başlangıç:</span>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Bitiş:</span>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          {(filterType !== "all" || filterFrom || filterTo) && (
            <button onClick={() => { setFilterType("all"); setFilterFrom(""); setFilterTo(""); }}
              className="text-xs text-red-500 hover:text-red-700 font-semibold">✕ Temizle</button>
          )}
          {(filterType !== "all" || filterFrom || filterTo) && (
            <span className="text-xs text-slate-400">{filtered.length} / {transactions.length} işlem</span>
          )}
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
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Vade Tarihi <span className="font-normal">(opsiyonel)</span></label>
                <input type="date" value={form.dueDate}
                  onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">İşlem Türü</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="receivable">📈 Borç +</option>
                  <option value="payable">📉 Borç -</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Tutar (₺)</label>
                <input type="number" required min="0.01" step="0.01" placeholder="0.00" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-500 block mb-1.5">Açıklama</label>
                <input required placeholder="İşlem açıklaması..." value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {!editingId && (
                <div className="sm:col-span-2">
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

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-slate-500 font-medium">
              {transactions.length === 0 ? "Henüz işlem eklenmedi" : "Filtreyle eşleşen işlem yok"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Tarih</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Vade</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Açıklama</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Borç +</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Borç -</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Bakiye</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Fatura</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((t) => {
                  const balance = parseFloat(t.runningBalance);
                  const amount = parseFloat(t.amount);
                  const overdue = isOverdue(t.dueDate);
                  return (
                    <tr key={t.id} className={`hover:bg-slate-50 transition-colors ${overdue ? "bg-red-50/40" : ""}`}>
                      <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap font-medium">{t.date}</td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        {t.dueDate ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${overdue ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                            {overdue ? "⚠️ " : ""}{t.dueDate}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-700">{t.description}</td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-red-500">
                        {t.type === "receivable" ? `+₺${fmt(amount)}` : ""}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold text-emerald-600">
                        {t.type === "payable" ? `-₺${fmt(amount)}` : ""}
                      </td>
                      <td className={`px-6 py-4 text-right text-sm font-bold ${balance > 0 ? "text-red-600" : balance < 0 ? "text-emerald-600" : "text-slate-400"}`}>
                        {balance > 0 ? "+" : ""}₺{fmt(balance)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {t.invoiceUrl ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 rounded-lg px-2 py-1">
                            📎 {t.invoiceFileName}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => openEdit(t)}
                            className="text-xs text-slate-400 hover:text-blue-500 transition-colors font-medium">Düzenle</button>
                          <button onClick={() => handleDelete(t.id)}
                            className="text-xs text-slate-300 hover:text-red-500 transition-colors font-medium">Sil</button>
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

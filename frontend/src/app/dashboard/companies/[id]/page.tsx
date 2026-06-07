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

export default function CompanyPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    type: "receivable" as "receivable" | "payable",
    amount: "",
  });
  const [invoice, setInvoice] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
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

      setForm({ date: new Date().toISOString().split("T")[0], description: "", type: "receivable", amount: "" });
      setInvoice(null);
      setShowForm(false);
      fetchData();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (txId: string) => {
    if (!confirm("Bu işlemi silmek istediğinize emin misiniz?")) return;
    await api.delete(`/transactions/${txId}`);
    fetchData();
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);

  if (loading) return <div className="flex justify-center mt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!company) return null;

  const receivable = parseFloat(company.totalReceivable || "0");
  const payable = parseFloat(company.totalPayable || "0");
  const net = receivable - payable;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
        <h1 className="text-xl font-bold">{company.name}</h1>
      </div>

      {/* Bakiye özeti */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-xs text-gray-500 mb-1">Alacak</p>
          <p className="text-xl font-bold text-green-600">{fmt(receivable)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-xs text-gray-500 mb-1">Verecek</p>
          <p className="text-xl font-bold text-red-500">{fmt(payable)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border">
          <p className="text-xs text-gray-500 mb-1">Net Bakiye</p>
          <p className={`text-xl font-bold ${net >= 0 ? "text-blue-600" : "text-red-600"}`}>{fmt(net)}</p>
        </div>
      </div>

      {/* İşlemler */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold">İşlemler</h2>
          <button onClick={() => setShowForm(!showForm)}
            className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition">
            + İşlem Ekle
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="px-6 py-4 border-b bg-gray-50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Tarih</label>
                <input type="date" required value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Tür</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="receivable">Alacak (bize borçlu)</option>
                  <option value="payable">Verecek (biz borçluyuz)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Açıklama</label>
              <input required placeholder="İşlem açıklaması" value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Tutar (₺)</label>
              <input type="number" required min="0.01" step="0.01" placeholder="0.00" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Fatura (opsiyonel)</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png"
                onChange={e => setInvoice(e.target.files?.[0] || null)}
                className="text-sm text-gray-500" />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)}
                className="text-sm px-4 py-1.5 border rounded-lg hover:bg-gray-100 transition">İptal</button>
              <button type="submit" disabled={saving}
                className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
            </div>
          </form>
        )}

        {transactions.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">Henüz işlem eklenmemiş.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">Tarih</th>
                  <th className="px-6 py-3 text-left">Açıklama</th>
                  <th className="px-6 py-3 text-right">Alacak</th>
                  <th className="px-6 py-3 text-right">Verecek</th>
                  <th className="px-6 py-3 text-right">Bakiye</th>
                  <th className="px-6 py-3 text-center">Fatura</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transactions.map((t) => {
                  const balance = parseFloat(t.runningBalance);
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{t.date}</td>
                      <td className="px-6 py-3">{t.description}</td>
                      <td className="px-6 py-3 text-right text-green-600 font-medium">
                        {t.type === "receivable" ? fmt(parseFloat(t.amount)) : ""}
                      </td>
                      <td className="px-6 py-3 text-right text-red-500 font-medium">
                        {t.type === "payable" ? fmt(parseFloat(t.amount)) : ""}
                      </td>
                      <td className={`px-6 py-3 text-right font-semibold ${balance >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {fmt(balance)}
                      </td>
                      <td className="px-6 py-3 text-center">
                        {t.invoiceUrl ? (
                          <span className="text-blue-500 text-xs">📎 {t.invoiceFileName}</span>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button onClick={() => handleDelete(t.id)}
                          className="text-red-400 hover:text-red-600 text-xs">Sil</button>
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

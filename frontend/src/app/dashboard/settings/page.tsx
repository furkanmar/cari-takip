"use client";
import { useState, useEffect } from "react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function SettingsPage() {
  const { user, fetchMe } = useAuthStore();

  const [profile, setProfile] = useState({ fullName: "", email: "" });
  const [profilePwd, setProfilePwd] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (user) setProfile({ fullName: user.fullName || "", email: user.email || "" });
  }, [user]);

  const handleProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileSaving(true);
    try {
      await api.put("/users/me", {
        fullName: profile.fullName,
        email: profile.email !== user?.email ? profile.email : undefined,
        currentPassword: profilePwd || undefined,
      });
      await fetchMe();
      setProfilePwd("");
      setProfileMsg({ ok: true, text: "Profil güncellendi." });
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setProfileMsg({ ok: false, text: Array.isArray(msg) ? msg.join(", ") : msg || "Hata oluştu." });
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    if (pwdForm.newPassword !== pwdForm.confirm) {
      setPwdMsg({ ok: false, text: "Yeni şifreler eşleşmiyor." });
      return;
    }
    if (pwdForm.newPassword.length < 6) {
      setPwdMsg({ ok: false, text: "Yeni şifre en az 6 karakter olmalı." });
      return;
    }
    setPwdSaving(true);
    try {
      await api.put("/users/me", {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      setPwdForm({ currentPassword: "", newPassword: "", confirm: "" });
      setPwdMsg({ ok: true, text: "Şifre güncellendi." });
    } catch (err: any) {
      const msg = err.response?.data?.message;
      setPwdMsg({ ok: false, text: Array.isArray(msg) ? msg.join(", ") : msg || "Hata oluştu." });
    } finally {
      setPwdSaving(false);
    }
  };

  const inputCls = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Ayarlar</h1>
        <p className="text-sm text-slate-400 mt-1">Hesap bilgilerinizi güncelleyin</p>
      </div>

      {/* Profil bilgileri */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-bold text-slate-800 mb-5">Profil Bilgileri</h2>
        <form onSubmit={handleProfile} className="space-y-4">
          {profileMsg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${profileMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {profileMsg.text}
            </p>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Ad Soyad</label>
            <input value={profile.fullName} onChange={e => setProfile({ ...profile, fullName: e.target.value })}
              placeholder="Ad Soyad" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">E-posta</label>
            <input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}
              placeholder="E-posta" className={inputCls} />
          </div>
          {profile.email !== user?.email && (
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1.5">Mevcut Şifre <span className="text-red-500">*</span></label>
              <input type="password" value={profilePwd} onChange={e => setProfilePwd(e.target.value)}
                placeholder="E-posta değişikliği için gerekli" className={inputCls} />
            </div>
          )}
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={profileSaving}
              className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {profileSaving ? "Kaydediliyor..." : "Güncelle"}
            </button>
          </div>
        </form>
      </div>

      {/* Şifre değiştir */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-bold text-slate-800 mb-5">Şifre Değiştir</h2>
        <form onSubmit={handlePassword} className="space-y-4">
          {pwdMsg && (
            <p className={`text-sm px-3 py-2 rounded-lg ${pwdMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
              {pwdMsg.text}
            </p>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Mevcut Şifre</label>
            <input type="password" value={pwdForm.currentPassword}
              onChange={e => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
              placeholder="••••••" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Yeni Şifre</label>
            <input type="password" value={pwdForm.newPassword}
              onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
              placeholder="En az 6 karakter" className={inputCls} />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 block mb-1.5">Yeni Şifre (Tekrar)</label>
            <input type="password" value={pwdForm.confirm}
              onChange={e => setPwdForm({ ...pwdForm, confirm: e.target.value })}
              placeholder="••••••" className={inputCls} />
          </div>
          <div className="flex justify-end pt-1">
            <button type="submit" disabled={pwdSaving}
              className="bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {pwdSaving ? "Kaydediliyor..." : "Şifreyi Güncelle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

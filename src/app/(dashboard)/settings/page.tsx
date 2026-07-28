"use client";
import { useState, useEffect } from "react";
import { Settings, User, Shield, Database } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [stats, setStats] = useState({ users: 0, pages: 0, campaigns: 0, expenses: 0 });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (data) { setProfile(data); setForm({ name: data.name, phone: data.phone || "" }); }
      }
      const { count: u } = await supabase.from("profiles").select("id",{count:"exact"});
      const { count: p } = await supabase.from("pages").select("id",{count:"exact"});
      const { count: c } = await supabase.from("campaigns").select("id",{count:"exact"});
      const { count: e } = await supabase.from("expenses").select("id",{count:"exact"});
      setStats({ users: u||0, pages: p||0, campaigns: c||0, expenses: e||0 });
    };
    init();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase.from("profiles").update({ name: form.name, phone: form.phone || null }).eq("id", profile.id);
    setMsg("✅ Đã lưu!"); setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Cài đặt</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-0.5">Thông tin cá nhân và hệ thống</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Profile */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <User size={16} className="text-[var(--muted-foreground)]"/>
            <span className="text-sm font-semibold">Thông tin cá nhân</span>
          </div>
          <div className="p-5 space-y-3">
            <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Email</label>
              <input value={profile?.email || ""} disabled className="w-full px-3 py-2 bg-[var(--muted)] border border-[var(--border)] rounded-lg text-sm opacity-60"/></div>
            <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Họ tên</label>
              <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"/></div>
            <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">SĐT</label>
              <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"/></div>
            <div><label className="block text-xs text-[var(--muted-foreground)] mb-1">Quyền</label>
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${profile?.role==="ADMIN"?"bg-red-500/10 text-red-400":"bg-zinc-500/10 text-zinc-400"}`}>{profile?.role}</span></div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">{saving?"Đang lưu...":"Lưu thay đổi"}</button>
              {msg && <span className="text-sm text-green-400">{msg}</span>}
            </div>
          </div>
        </div>

        {/* System Stats */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2">
            <Database size={16} className="text-[var(--muted-foreground)]"/>
            <span className="text-sm font-semibold">Thống kê hệ thống</span>
          </div>
          <div className="p-5 space-y-3">
            {[
              { label: "Nhân viên", value: stats.users },
              { label: "Pages", value: stats.pages },
              { label: "Campaigns", value: stats.campaigns },
              { label: "Bản ghi chi phí", value: stats.expenses },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-b-0">
                <span className="text-sm text-[var(--muted-foreground)]">{s.label}</span>
                <span className="font-mono text-sm font-semibold">{s.value}</span>
              </div>
            ))}
          </div>
          <div className="px-5 pb-5">
            <div className="bg-[var(--muted)] rounded-lg p-3 text-xs text-[var(--muted-foreground)]">
              <div className="font-medium mb-1">Supabase Free Tier</div>
              <div>Database: 500MB • Auth: Unlimited • Realtime: 200 connections</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

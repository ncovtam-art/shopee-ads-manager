"use client";
import { useState, useEffect } from "react";
import { Settings, User, Shield, Database, Info } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function SettingsPage() {
  const supabase = createClient();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user);
        supabase.from("profiles").select("*").eq("id", data.user.id).single().then(({ data: p }) => setProfile(p));
      }
    });
  }, []);

  return (
    <div>
      <h1 className="text-lg font-bold mb-1">Cài đặt</h1>
      <p className="text-xs text-[var(--muted-foreground)] mb-5">Thông tin tài khoản và hệ thống</p>

      <div className="space-y-4 max-w-2xl">
        {/* Account */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
            <User size={14} className="text-[var(--accent)]" />
            <span className="text-sm font-semibold">Tài khoản</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">Email</span>
              <span className="text-xs font-mono">{user?.email || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">Tên</span>
              <span className="text-xs font-medium">{profile?.name || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">Quyền</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${profile?.role === "ADMIN" ? "bg-red-500/10 text-red-400" : "bg-zinc-500/10 text-zinc-400"}`}>{profile?.role || "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">SĐT</span>
              <span className="text-xs">{profile?.phone || "—"}</span>
            </div>
          </div>
        </div>

        {/* System info */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
            <Info size={14} className="text-[var(--muted-foreground)]" />
            <span className="text-sm font-semibold">Hệ thống</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">Phiên bản</span>
              <span className="text-xs font-mono">v3.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">Framework</span>
              <span className="text-xs font-mono">Next.js + Supabase</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">Database</span>
              <span className="text-xs font-mono">PostgreSQL (Supabase)</span>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="text-center text-[11px] text-[var(--muted-foreground)] py-4">
          <p>Shopee Ads Manager v3.0</p>
          <p>© 2026 Minh Tâm · Hỗ trợ kỹ thuật: 0877 260 675</p>
        </div>
      </div>
    </div>
  );
}

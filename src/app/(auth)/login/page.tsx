"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#ee4d2d] to-[#ff6b47] text-white font-extrabold text-base mb-3">S$</div>
          <h1 className="text-lg font-bold">Shopee Ads Manager</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">Đăng nhập để tiếp tục</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="email@company.vn" required />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1">Mật khẩu</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="••••••••" required />
            </div>
            {error && <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-[var(--muted-foreground)] mt-4">
        </p>
        <div className="text-center mt-4 space-y-0.5">
          <p className="text-[11px] text-[var(--muted-foreground)]">Được phát triển bởi <span className="font-medium text-[var(--foreground)]">Minh Tâm</span></p>
          <p className="text-[11px] text-[var(--muted-foreground)]">Hỗ trợ kỹ thuật: 0877 260 675</p>
        </div>
      </div>
    </div>
  );
}

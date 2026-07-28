"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) { setError("Điền đầy đủ thông tin"); return; }
    if (password.length < 6) { setError("Mật khẩu tối thiểu 6 ký tự"); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, phone, role: "EMPLOYEE" }),
      });
      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || "Không tạo được tài khoản");
        setLoading(false);
        return;
      }

      // Auto login after register
      const supabase = createClient();
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
      if (loginErr) {
        setError("Tạo tài khoản thành công! Vui lòng đăng nhập.");
        setTimeout(() => router.push("/login"), 1500);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (e: any) {
      setError(e?.message || "Lỗi không xác định");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#ee4d2d] to-[#ff6b47] text-white font-extrabold text-base mb-3">S$</div>
          <h1 className="text-lg font-bold">Đăng ký tài khoản</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-1">Tạo tài khoản nhân viên mới</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1">Họ tên *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="Nguyễn Văn A" required />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1">Email *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="email@gmail.com" required />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1">Số điện thoại</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="0901234567" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1">Mật khẩu *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                placeholder="Tối thiểu 6 ký tự" required />
            </div>
            {error && <div className={`text-sm rounded-lg px-3 py-2 ${error.includes("thành công") ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-[#ee4d2d] to-[#ff6b47] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50">
              {loading ? "Đang tạo..." : "Đăng ký"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-[var(--muted-foreground)] mt-4">
          Đã có tài khoản? <Link href="/login" className="text-[var(--accent)] font-medium hover:underline">Đăng nhập</Link>
        </p>
        <div className="text-center mt-4 space-y-0.5">
          <p className="text-[11px] text-[var(--muted-foreground)]">Được phát triển bởi <span className="font-medium text-[var(--foreground)]">Minh Tâm</span></p>
          <p className="text-[11px] text-[var(--muted-foreground)]">Hỗ trợ kỹ thuật: 0877 260 675</p>
        </div>
      </div>
    </div>
  );
}

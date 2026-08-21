"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { TrendingUp, ShieldCheck, Zap } from "lucide-react";

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
    if (error) { setError(error.message); setLoading(false); }
    else { router.push("/"); router.refresh(); }
  };

  return (
    <div className="min-h-screen flex bg-[var(--background)] relative overflow-hidden">
      {/* Aurora orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-30 blur-[120px]" style={{ background: "radial-gradient(circle, #ee4d2d, transparent)" }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]" style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />

      {/* Left: Brand showcase (desktop only) */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ee4d2d] to-[#ff6b47] flex items-center justify-center text-white font-extrabold text-sm shadow-lg shadow-[#ee4d2d]/20">S$</div>
          <span className="text-base font-bold tracking-tight">Shopee Ads Manager</span>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight mb-4 gradient-text">Quản lý hiệu suất<br />quảng cáo & affiliate<br />trong một nơi.</h1>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-8">Theo dõi chi phí Facebook Ads, đối chiếu hoa hồng Shopee, tính P&L từng page và campaign theo thời gian thực.</p>

          <div className="space-y-4">
            {[
              { icon: TrendingUp, title: "P&L thời gian thực", desc: "Lãi lỗ từng chiến dịch, từng ngày", color: "#22c55e" },
              { icon: Zap, title: "Import tự động", desc: "Ghép FB Ads ↔ Shopee chỉ với 1 click", color: "#f59e0b" },
              { icon: ShieldCheck, title: "Phân quyền chặt chẽ", desc: "Admin, Leader, Nhân viên riêng biệt", color: "#6366f1" },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 animate-in" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${f.color}15` }}>
                  <f.icon size={16} style={{ color: f.color }} />
                </div>
                <div>
                  <div className="text-sm font-semibold">{f.title}</div>
                  <div className="text-xs text-[var(--muted-foreground)]">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs text-[var(--muted-foreground)]">© 2026 Minh Tâm · Hỗ trợ: 0877 260 675</div>
      </div>

      {/* Right: Login form */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-sm animate-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ee4d2d] to-[#ff6b47] text-white font-extrabold text-lg mb-3 shadow-lg shadow-[#ee4d2d]/25">S$</div>
            <h1 className="text-lg font-bold">Shopee Ads Manager</h1>
          </div>

          <div className="glass-card rounded-2xl p-7 border border-[var(--border)] shadow-2xl noise">
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-1">Chào mừng trở lại 👋</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Đăng nhập để tiếp tục quản lý</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-3.5 py-2.5 bg-[var(--input)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                  placeholder="email@gmail.com" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[var(--muted-foreground)] mb-1.5">Mật khẩu</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  className="w-full px-3.5 py-2.5 bg-[var(--input)] border border-[var(--border)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                  placeholder="••••••••" />
              </div>
              {error && <div className="text-sm rounded-xl px-3.5 py-2.5 text-red-400 bg-red-500/10 border border-red-500/10">{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 btn-gradient text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-[var(--muted-foreground)] mt-6 lg:hidden">© 2026 Minh Tâm · 0877 260 675</p>
        </div>
      </div>
    </div>
  );
}

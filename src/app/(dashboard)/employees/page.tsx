"use client";
import { useState, useEffect } from "react";
import { Users, Plus, Search, MoreHorizontal, X } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatMoney } from "@/lib/utils";

type Profile = {
  id: string; name: string; email: string; phone: string | null;
  role: string; status: string; join_date: string; pages_count?: number;
};

export default function EmployeesPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "EMPLOYEE", password: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchEmployees = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setEmployees(data);
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleAdd = async () => {
    if (!form.email || !form.name || !form.password) {
      setMsg("Điền đầy đủ tên, email và mật khẩu"); return;
    }
    setSaving(true);
    setMsg("");

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name, role: form.role } }
    });

    if (error) {
      setMsg("Lỗi: " + error.message);
      setSaving(false);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").update({
        name: form.name,
        phone: form.phone || null,
        role: form.role as any,
      }).eq("id", data.user.id);
    }

    setForm({ name: "", email: "", phone: "", role: "EMPLOYEE", password: "" });
    setShowAdd(false);
    setSaving(false);
    fetchEmployees();
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await supabase.from("profiles").update({ status: newStatus }).eq("id", id);
    fetchEmployees();
  };

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  const roleColors: Record<string, string> = {
    ADMIN: "bg-red-500/10 text-red-400",
    LEADER: "bg-blue-500/10 text-blue-400",
    EMPLOYEE: "bg-zinc-500/10 text-zinc-400",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Nhân viên</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{employees.length} nhân viên trong hệ thống</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
          <Plus size={14} /> Thêm nhân viên
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 mb-4 max-w-sm">
        <Search size={14} className="text-[var(--muted-foreground)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm nhân viên..." className="bg-transparent border-none outline-none text-sm flex-1" />
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Nhân viên</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Quyền</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">SĐT</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Ngày vào</th>
                <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Trạng thái</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">Đang tải...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[var(--muted-foreground)]">Chưa có nhân viên nào</td></tr>
              ) : filtered.map(emp => (
                <tr key={emp.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent)] to-orange-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {emp.name.split(" ").map(w => w[0]).slice(-2).join("").toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{emp.name}</div>
                        <div className="text-[11px] text-[var(--muted-foreground)]">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${roleColors[emp.role] || roleColors.EMPLOYEE}`}>
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{emp.phone || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--muted-foreground)] font-mono text-xs">{emp.join_date}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleStatus(emp.id, emp.status)} className={`text-[11px] font-semibold px-2.5 py-1 rounded-full cursor-pointer ${
                      emp.status === "ACTIVE" ? "bg-green-500/10 text-green-400" : "bg-zinc-500/10 text-zinc-400"
                    }`}>
                      {emp.status === "ACTIVE" ? "Hoạt động" : "Ngưng"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button className="w-7 h-7 rounded-md border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
                      <MoreHorizontal size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-base font-semibold">Thêm nhân viên</span>
              <button onClick={() => setShowAdd(false)} className="text-[var(--muted-foreground)]"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Họ tên *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="email@company.vn" />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Mật khẩu *</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="Tối thiểu 6 ký tự" />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Số điện thoại</label>
                <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" placeholder="0901234567" />
              </div>
              <div>
                <label className="block text-xs text-[var(--muted-foreground)] mb-1">Quyền</label>
                <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full px-3 py-2 bg-[var(--input)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                  <option value="EMPLOYEE">Nhân viên</option>
                  <option value="LEADER">Leader</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {msg && <div className="text-sm text-[var(--danger)] bg-red-500/10 rounded-lg px-3 py-2">{msg}</div>}
              <button onClick={handleAdd} disabled={saving} className="w-full py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {saving ? "Đang tạo..." : "Tạo nhân viên"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

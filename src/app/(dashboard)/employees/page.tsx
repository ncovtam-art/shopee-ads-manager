"use client";
import { useState, useEffect } from "react";
import { Users, Plus, Search, X, Shield, User, Phone, Mail, MoreHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase";

type Profile = { id: string; name: string; email: string; phone: string | null; role: string; status: string; join_date: string };

export default function EmployeesPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "EMPLOYEE", password: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (data) setEmployees(data);
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleAdd = async () => {
    if (!form.email || !form.name || !form.password) { setMsg("Điền đầy đủ tên, email và mật khẩu"); return; }
    if (form.password.length < 6) { setMsg("Mật khẩu tối thiểu 6 ký tự"); return; }
    setSaving(true); setMsg("");
    try {
      const res = await fetch("/api/create-user", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password, name: form.name, phone: form.phone, role: form.role }),
      });
      const result = await res.json();
      if (!res.ok || result.error) { setMsg("Lỗi: " + (result.error || "Không xác định")); setSaving(false); return; }
      setMsg("✅ Tạo thành công!");
      setForm({ name: "", email: "", phone: "", role: "EMPLOYEE", password: "" });
      setTimeout(() => { setShowAdd(false); setMsg(""); }, 1200);
      fetchEmployees();
    } catch (e: any) { setMsg("Lỗi: " + e?.message); }
    setSaving(false);
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await supabase.from("profiles").update({ status: newStatus }).eq("id", id);
    fetchEmployees();
  };

  const updateRole = async (id: string, role: string) => {
    await supabase.from("profiles").update({ role }).eq("id", id);
    fetchEmployees();
  };

  const filtered = employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase()));

  const roleColor: Record<string, string> = { ADMIN: "bg-red-500/10 text-red-400", LEADER: "bg-blue-500/10 text-blue-400", EMPLOYEE: "bg-zinc-500/10 text-zinc-400" };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold">Nhân viên</h1>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{employees.length} nhân viên trong hệ thống</p>
        </div>
        <button onClick={() => { setShowAdd(true); setMsg(""); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90">
          <Plus size={12} /> Thêm
        </button>
      </div>

      <div className="flex items-center gap-1.5 bg-[var(--card)] border border-[var(--border)] rounded-md px-2.5 py-1.5 mb-3 max-w-xs">
        <Search size={12} className="text-[var(--muted-foreground)]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm nhân viên..." className="bg-transparent text-xs outline-none flex-1" />
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead><tr className="border-b border-[var(--border)]">
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Nhân viên</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Quyền</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">SĐT</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Ngày vào</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-[var(--muted-foreground)] uppercase">Trạng thái</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-[var(--muted-foreground)]">Đang tải...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-[var(--muted-foreground)]">Chưa có nhân viên</td></tr>
              ) : filtered.map(emp => (
                <tr key={emp.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)] transition-colors">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent)] to-orange-400 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {emp.name.split(" ").map(w => w[0]).slice(-2).join("").toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-medium">{emp.name}</div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <select value={emp.role} onChange={e => updateRole(emp.id, e.target.value)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border-none outline-none cursor-pointer ${roleColor[emp.role] || roleColor.EMPLOYEE}`}>
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="LEADER">LEADER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-xs text-[var(--muted-foreground)]">{emp.phone || "—"}</td>
                  <td className="px-3 py-2 text-xs text-[var(--muted-foreground)] font-mono">{emp.join_date}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => toggleStatus(emp.id, emp.status)}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer ${emp.status === "ACTIVE" ? "bg-green-500/10 text-green-400" : "bg-zinc-500/10 text-zinc-400"}`}>
                      {emp.status === "ACTIVE" ? "Hoạt động" : "Ngưng"}
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
          <div onClick={e => e.stopPropagation()} className="w-full max-w-md bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <span className="text-sm font-semibold">Thêm nhân viên</span>
              <button onClick={() => setShowAdd(false)} className="text-[var(--muted-foreground)]"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2.5">
              <div>
                <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Họ tên *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs" placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Email *</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs" placeholder="email@gmail.com" />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Mật khẩu *</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs" placeholder="Tối thiểu 6 ký tự" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">SĐT</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs" placeholder="090..." />
                </div>
                <div>
                  <label className="block text-[10px] text-[var(--muted-foreground)] mb-0.5">Quyền</label>
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full px-2.5 py-1.5 bg-[var(--input)] border border-[var(--border)] rounded-md text-xs">
                    <option value="EMPLOYEE">Nhân viên</option>
                    <option value="LEADER">Leader</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
              </div>
              {msg && <div className={`text-xs rounded px-2.5 py-1.5 ${msg.includes("✅") ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>{msg}</div>}
              <button onClick={handleAdd} disabled={saving} className="w-full py-2 bg-[var(--accent)] text-white rounded-md text-xs font-semibold hover:opacity-90 disabled:opacity-50">
                {saving ? "Đang tạo..." : "Tạo nhân viên"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

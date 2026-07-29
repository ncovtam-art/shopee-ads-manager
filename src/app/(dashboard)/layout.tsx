"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, BarChart3, FileText, Upload, Users, Settings,
  Search, Menu, LogOut, Bell
} from "lucide-react";
import { createClient } from "@/lib/supabase";

const navItems = [
  { divider: true, label: "TỔNG QUAN" },
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { divider: true, label: "HIỆU SUẤT" },
  { href: "/reports", icon: BarChart3, label: "Báo cáo P&L" },
  { href: "/pages", icon: FileText, label: "Pages" },
  { divider: true, label: "DỮ LIỆU" },
  { href: "/import", icon: Upload, label: "Import báo cáo" },
  { divider: true, label: "QUẢN LÝ" },
  { href: "/employees", icon: Users, label: "Nhân viên" },
  { divider: true, label: "HỆ THỐNG" },
  { href: "/settings", icon: Settings, label: "Cài đặt" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  // Auth check — redirect to /login if not authenticated
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
      setUserName(profile?.name || user.email || "User");
      setUserRole(profile?.role || "EMPLOYEE");
      setAuthChecked(true);
    };
    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  // Don't render anything until auth is confirmed
  if (!authChecked) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--background)]">
        <div className="text-sm text-[var(--muted-foreground)]">Đang kiểm tra đăng nhập...</div>
      </div>
    );
  }

  const isAdmin = userRole === "ADMIN" || userRole === "LEADER";

  // Filter nav items for employees
  const visibleNav = navItems.filter(item => {
    if (item.href === "/employees" && !isAdmin) return false;
    return true;
  });

  const Sidebar = () => (
    <aside className={`h-screen bg-[#0a0b10] border-r border-[var(--border)] flex flex-col transition-all duration-200 ${sidebarOpen ? "w-56" : "w-14"}`}>
      <div className={`flex items-center gap-2 min-h-[52px] ${sidebarOpen ? "px-3 pt-3 pb-1" : "px-2 pt-3 pb-1 justify-center"}`}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ee4d2d] to-[#ff6b47] flex items-center justify-center text-white font-extrabold text-xs shrink-0 cursor-pointer">S$</button>
        {sidebarOpen && <span className="text-xs font-bold whitespace-nowrap tracking-tight">Shopee Ads Manager</span>}
      </div>
      <nav className="flex-1 px-1.5 py-1 overflow-y-auto overflow-x-hidden space-y-0.5">
        {visibleNav.map((item, i) => {
          if (item.divider) return sidebarOpen ? (<div key={i} className="px-2 pt-3 pb-1 text-[9px] font-bold text-[var(--muted-foreground)] tracking-[0.12em] uppercase">{item.label}</div>) : (<div key={i} className="h-px bg-[var(--border)] mx-1 my-1.5" />);
          const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href!));
          const Icon = item.icon!;
          return (
            <Link key={item.href} href={item.href!} onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-all relative ${sidebarOpen ? "" : "justify-center"} ${active ? "bg-[rgba(238,77,45,0.08)] text-[var(--accent)]" : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"}`}>
              {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r bg-[var(--accent)]" />}
              <Icon size={16} />
              {sidebarOpen && <span className={`whitespace-nowrap ${active ? "font-semibold" : ""}`}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      {sidebarOpen && (
        <div className="px-3 py-2 border-t border-[var(--border)]">
          <div className="text-[9px] text-[var(--muted-foreground)] text-center mb-2 leading-tight">© 2026 Minh Tâm<br/>Hỗ trợ: 0877 260 675</div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#ee4d2d] to-[#ff6b47] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              {userName.split(" ").map(w => w[0]).slice(-2).join("").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold truncate">{userName}</div>
              <div className="text-[9px] text-[var(--muted-foreground)]">{userRole}</div>
            </div>
            <button onClick={handleLogout} className="text-[var(--muted-foreground)] hover:text-[var(--danger)] transition-colors"><LogOut size={14} /></button>
          </div>
        </div>
      )}
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:block"><Sidebar /></div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-56"><Sidebar /></div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 border-b border-[var(--border)] bg-[#0a0b10] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileOpen(true)} className="md:hidden text-[var(--muted-foreground)]"><Menu size={18} /></button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--muted-foreground)] font-mono">{userName}</span>
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${userRole === "ADMIN" ? "bg-red-500/10 text-red-400" : "bg-zinc-500/10 text-zinc-400"}`}>{userRole}</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-5">{children}</main>
      </div>
    </div>
  );
}

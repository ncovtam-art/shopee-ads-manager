"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, FileText,
  DollarSign, Upload, Bell, History,
  Settings, Search, Menu, LogOut, BarChart3
} from "lucide-react";
import { createClient } from "@/lib/supabase";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Tổng quan" },
  { divider: true, label: "DỮ LIỆU" },
  { href: "/import", icon: Upload, label: "Import CSV" },
  { href: "/reports", icon: BarChart3, label: "Báo cáo P&L" },
  { divider: true, label: "QUẢN LÝ" },
  { href: "/employees", icon: Users, label: "Nhân viên" },
  { href: "/pages", icon: FileText, label: "Pages" },
  { href: "/expenses", icon: DollarSign, label: "Chi phí" },
  { divider: true, label: "HỆ THỐNG" },
  { href: "/notifications", icon: Bell, label: "Thông báo" },
  { href: "/logs", icon: History, label: "Lịch sử" },
  { href: "/settings", icon: Settings, label: "Cài đặt" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const Sidebar = () => (
    <aside
      className={`h-screen bg-[#0c0e14] border-r border-[var(--border)] flex flex-col transition-all duration-200 ${
        sidebarOpen ? "w-60" : "w-16"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 min-h-[56px] ${sidebarOpen ? "px-4 pt-4 pb-2" : "px-3 pt-4 pb-2 justify-center"}`}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ee4d2d] to-[#ff8a65] flex items-center justify-center text-white font-extrabold text-sm shrink-0 cursor-pointer"
        >
          S$
        </button>
        {sidebarOpen && (
          <span className="text-sm font-bold whitespace-nowrap tracking-tight">
            Shopee Ads Manager
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden space-y-0.5">
        {navItems.map((item, i) => {
          if (item.divider) {
            return sidebarOpen ? (
              <div key={i} className="px-2.5 pt-4 pb-1.5 text-[10px] font-bold text-[var(--muted-foreground)] tracking-widest">
                {item.label}
              </div>
            ) : (
              <div key={i} className="h-px bg-[var(--border)] mx-1.5 my-2" />
            );
          }

          const active = pathname === item.href;
          const Icon = item.icon!;

          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all relative ${
                sidebarOpen ? "" : "justify-center"
              } ${
                active
                  ? "bg-[rgba(238,77,45,0.08)] text-[var(--accent)]"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-[var(--accent)]" />
              )}
              <Icon size={18} />
              {sidebarOpen && (
                <>
                  <span className={`whitespace-nowrap ${active ? "font-semibold" : ""}`}>
                    {item.label}
                  </span>
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {sidebarOpen && (
        <div className="p-3 border-t border-[var(--border)] flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ee4d2d] to-[#ff8a65] flex items-center justify-center text-white text-xs font-bold shrink-0">
            AD
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate">Admin</div>
            <div className="text-[11px] text-[var(--muted-foreground)]">admin@company.vn</div>
          </div>
          <button onClick={handleLogout} className="text-[var(--muted-foreground)] hover:text-[var(--danger)] transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      )}
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-60">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-[var(--border)] bg-[#0c0e14] flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="md:hidden text-[var(--muted-foreground)]">
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 bg-[var(--input)] border border-[var(--border)] rounded-lg px-3 py-1.5 min-w-[200px] cursor-pointer hover:border-[var(--muted-foreground)] transition-colors">
              <Search size={14} className="text-[var(--muted-foreground)]" />
              <span className="text-sm text-[var(--muted-foreground)]">Tìm kiếm...</span>
              <span className="ml-auto text-[10px] text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded font-mono">⌘K</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative w-9 h-9 rounded-lg flex items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--accent)] ring-2 ring-[#0c0e14]" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { Bell, Check, AlertTriangle, TrendingDown, ClipboardCheck, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase";

export default function NotificationsPage() {
  const supabase = createClient();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase.from("notifications").select("*").order("created_at",{ascending:false}).limit(50);
    if (data) setNotifications(data);
    setLoading(false);
  };
  useEffect(() => { fetch(); }, []);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    fetch();
  };

  const markAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
      fetch();
    }
  };

  const iconMap: Record<string, { icon: any; color: string }> = {
    ROI_NEGATIVE: { icon: TrendingDown, color: "text-red-400" },
    ADS_OVER_COMMISSION: { icon: DollarSign, color: "text-amber-400" },
    PAGE_LOSS_3D: { icon: AlertTriangle, color: "text-red-400" },
    RECONCILE_MISSING: { icon: ClipboardCheck, color: "text-amber-400" },
  };

  const unread = notifications.filter(n => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Thông báo</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-0.5">{unread > 0 ? `${unread} chưa đọc` : "Tất cả đã đọc"}</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]">
            <Check size={14}/> Đánh dấu tất cả đã đọc
          </button>
        )}
      </div>

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-[var(--muted-foreground)]">Đang tải...</div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell size={32} className="mx-auto mb-3 text-[var(--muted-foreground)] opacity-40"/>
            <div className="text-sm text-[var(--muted-foreground)]">Chưa có thông báo nào</div>
          </div>
        ) : notifications.map(n => {
          const ic = iconMap[n.type] || { icon: Bell, color: "text-[var(--muted-foreground)]" };
          const Icon = ic.icon;
          return (
            <div key={n.id} onClick={() => !n.read && markRead(n.id)}
              className={`px-5 py-4 flex items-start gap-3 border-b border-[var(--border)] cursor-pointer transition-colors ${n.read ? "opacity-60" : "hover:bg-[var(--muted)]"}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.read ? "bg-[var(--muted)]" : "bg-[var(--muted)]"}`}>
                <Icon size={16} className={ic.color}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{n.message}</div>
                <div className="text-[11px] text-[var(--muted-foreground)] mt-1">{new Date(n.created_at).toLocaleString("vi-VN")}</div>
              </div>
              {!n.read && <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0 mt-2"/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

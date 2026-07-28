"use client";
import { History } from "lucide-react";

export default function Page() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Lịch sử</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">Audit Log — ai sửa gì, lúc nào</p>
      </div>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
          <History size={28} className="text-[var(--muted-foreground)]" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Module Lịch sử</h2>
        <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto">
          Audit Log — ai sửa gì, lúc nào. Đang được phát triển trong Phase 2.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-xs text-[var(--accent)] font-medium">
          🚧 Đang phát triển
        </div>
      </div>
    </div>
  );
}

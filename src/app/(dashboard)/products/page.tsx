"use client";
import { Package } from "lucide-react";

export default function Page() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Sản phẩm</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">Danh sách sản phẩm đang promote</p>
      </div>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center mx-auto mb-4">
          <Package size={28} className="text-[var(--muted-foreground)]" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Module Sản phẩm</h2>
        <p className="text-sm text-[var(--muted-foreground)] max-w-md mx-auto">
          Danh sách sản phẩm đang promote. Đang được phát triển trong Phase 2.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 text-xs text-[var(--accent)] font-medium">
          🚧 Đang phát triển
        </div>
      </div>
    </div>
  );
}

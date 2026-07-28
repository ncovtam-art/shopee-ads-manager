"use client";
import Link from "next/link";

export default function Page() {
  return (
    <div className="p-12 text-center">
      <p className="text-sm text-[var(--muted-foreground)] mb-4">Trang này đã được gộp vào Báo cáo P&L.</p>
      <Link href="/reports" className="text-sm text-[var(--accent)] hover:underline">Đi tới Báo cáo P&L →</Link>
    </div>
  );
}

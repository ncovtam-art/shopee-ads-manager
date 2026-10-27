"use client";

export function DataError({ onRetry }: { onRetry: () => void }) {
  return <div role="alert" className="glass-card rounded-xl border border-red-500/30 p-6">
    <h2 className="font-semibold mb-2">Chưa tải được dữ liệu</h2>
    <p className="text-sm text-[var(--muted-foreground)] mb-4">
      Kết nối hoặc quyền truy cập chưa sẵn sàng. Thử lại hoặc liên hệ quản trị viên.
      Không thể xác nhận số liệu khi truy vấn chưa thành công.
    </p>
    <button className="px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm" onClick={onRetry}>Thử lại</button>
  </div>;
}

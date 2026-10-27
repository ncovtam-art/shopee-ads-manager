import { getAuthUser } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Auth check
    const { user, profile } = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
    if (!profile || profile.status !== "ACTIVE")
      return NextResponse.json({ error: "Tài khoản không có quyền truy cập" }, { status: 403 });

    // This API now only serves as a fallback — main data comes from RPC
    return NextResponse.json({ success: true, authenticated: true, role: profile?.role });
  } catch {
    return NextResponse.json({ error: "Không thể đọc trạng thái tài khoản." }, { status: 500 });
  }
}

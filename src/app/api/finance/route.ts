import { getAuthUser } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Auth check
    const { user, profile, supabase } = await getAuthUser();
    if (!user) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

    // This API now only serves as a fallback — main data comes from RPC
    return NextResponse.json({ success: true, authenticated: true, role: profile?.role });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

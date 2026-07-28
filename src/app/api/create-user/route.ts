import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, phone, role } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Thiếu email, password hoặc tên" }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY trên Vercel" },
        { status: 500 }
      );
    }

    // Admin client with service role key (server-side only)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create user via admin API
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm
      user_metadata: { name, role },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data.user) {
      // Update profile
      await supabaseAdmin.from("profiles").update({
        name,
        phone: phone || null,
        role: role || "EMPLOYEE",
      }).eq("id", data.user.id);
    }

    return NextResponse.json({ success: true, userId: data.user?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi server" }, { status: 500 });
  }
}

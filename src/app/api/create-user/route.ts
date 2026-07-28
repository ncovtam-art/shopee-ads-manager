import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, phone, role } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Thiếu email, password hoặc tên" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Thiếu Supabase config" }, { status: 500 });
    }

    // Server-side client — no session conflict with browser
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // SignUp new user (server-side, won't affect admin session in browser)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role },
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json(
        { error: "Không tạo được user. Email có thể đã tồn tại." },
        { status: 400 }
      );
    }

    // Update profile (use service role if available, otherwise anon)
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey;
    const adminClient = createClient(supabaseUrl, adminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await adminClient.from("profiles").update({
      name,
      phone: phone || null,
      role: role || "EMPLOYEE",
    }).eq("id", data.user.id);

    return NextResponse.json({ success: true, userId: data.user.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi server" }, { status: 500 });
  }
}

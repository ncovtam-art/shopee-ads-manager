import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password, name, phone, role, debug } = await req.json();

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

    // Debug mode - check config without creating user
    if (debug) {
      return NextResponse.json({
        hasUrl: !!supabaseUrl,
        urlPrefix: supabaseUrl.slice(0, 30),
        hasKey: !!serviceKey,
        keyPrefix: serviceKey.slice(0, 10) + "...",
        keyLength: serviceKey.length,
      });
    }

    if (!email || !password || !name) {
      return NextResponse.json({ error: "Thiếu email, password hoặc tên" }, { status: 400 });
    }

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json(
        { error: `Thiếu config: URL=${!!supabaseUrl}, KEY=${!!serviceKey}` },
        { status: 500 }
      );
    }

    // Call GoTrue Admin API directly
    const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role },
      }),
    });

    const authData = await authRes.json();

    if (!authRes.ok) {
      return NextResponse.json(
        { error: authData.msg || authData.message || authData.error || JSON.stringify(authData) },
        { status: authRes.status }
      );
    }

    // Update profile
    if (authData.id) {
      await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${authData.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          name,
          phone: phone || null,
          role: role || "EMPLOYEE",
        }),
      });
    }

    return NextResponse.json({ success: true, userId: authData.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi server" }, { status: 500 });
  }
}

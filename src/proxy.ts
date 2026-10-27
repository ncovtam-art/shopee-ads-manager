import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "./lib/route-access";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Chưa cấu hình Supabase ở máy chủ." }, { status: 503 })
      : NextResponse.redirect(new URL("/login?error=configuration", request.url));
  }
  let response = NextResponse.next({ request });
  const withCookies = (target: NextResponse) => {
    response.cookies.getAll().forEach(cookie => target.cookies.set(cookie));
    target.headers.set("Cache-Control", "private, no-store");
    return target;
  };

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          const prior = response.cookies.getAll();
          response = NextResponse.next({ request });
          prior.forEach(cookie => response.cookies.set(cookie));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = error ? null : data.user;
  } catch {
    return withCookies(NextResponse.json({ error: "Dịch vụ đăng nhập chưa sẵn sàng." }, { status: 503 }));
  }

  // Chưa đăng nhập → redirect /login
  if (!user) {
    if (pathname.startsWith("/api/"))
      return withCookies(NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 }));
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return withCookies(NextResponse.redirect(loginUrl));
  }

  const { data: profile, error } = await supabase.from("profiles")
    .select("status").eq("id", user.id).single();
  if (error || !profile || profile.status !== "ACTIVE") {
    return pathname.startsWith("/api/")
      ? withCookies(NextResponse.json({ error: "Tài khoản không có quyền truy cập." }, { status: 403 }))
      : withCookies(NextResponse.redirect(new URL("/login?error=account", request.url)));
  }

  // Block /register
  if (pathname === "/register") {
    return withCookies(NextResponse.redirect(new URL("/", request.url)));
  }

  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

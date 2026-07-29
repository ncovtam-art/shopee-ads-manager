import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component — ignore
          }
        },
      },
    }
  );
}

// Get current user + profile (role, assigned pages)
export async function getAuthUser() {
  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (!user || error) return { user: null, profile: null, supabase };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, role, status")
    .eq("id", user.id)
    .single();

  return { user, profile, supabase };
}

// Check if user can access a specific page
export async function canAccessPage(userId: string, role: string, pageId: string) {
  if (role === "ADMIN" || role === "LEADER") return true;

  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("pages")
    .select("id")
    .eq("id", pageId)
    .eq("assignee_id", userId)
    .single();

  return !!data;
}

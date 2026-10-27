import { getAuthUser } from "@/lib/supabase-server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { handleCreateUser } from "@/lib/create-user-handler";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let client: SupabaseClient | undefined;
  const admin = () => {
    if (!url || !key) throw new Error("Administration configuration unavailable");
    return client ??= createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  };
  return handleCreateUser(request, {
    configurationReady: Boolean(url && key),
    async resolveActor() {
      const { user, profile } = await getAuthUser();
      return user && profile ? { id: user.id, role: profile.role, status: profile.status } : null;
    },
    async createAccount(input) {
      const { data, error } = await admin().auth.admin.createUser({
        email: input.email, password: input.password,
        user_metadata: { name: input.name }, email_confirm: true,
      });
      return error ? null : data.user?.id ?? null;
    },
    async updateProfile(id, input) {
      const { data, error } = await admin().from("profiles")
        .update({ name: input.name, phone: input.phone, role: input.role })
        .eq("id", id).select("id").single();
      return !error && data?.id === id;
    },
    async removeNewAccount(id) {
      const { error } = await admin().auth.admin.deleteUser(id);
      return !error;
    },
  }, process.env.APP_ORIGIN);
}

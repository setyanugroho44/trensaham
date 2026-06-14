import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AccessInfo = {
  hasAccess: boolean;
  tier: "free" | "pro";
  trialEndsAt: string | null;
  proEndsAt: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  reason: "admin" | "pro" | "trial" | "expired";
};
const SUPPORT_AGENT_EMAILS = ["setyanugroho44@gmail.com"];

export async function loadAccess(userId: string): Promise<AccessInfo> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = !!roles?.some((r) => r.role === "admin");
  const isSuperAdmin = !!roles?.some((r) => r.role === "super_admin");

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("tier, trial_ends_at, pro_ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  const now = Date.now();
  const proActive =
    sub?.tier === "pro" && sub.pro_ends_at && new Date(sub.pro_ends_at).getTime() > now;
  const trialActive =
    sub?.trial_ends_at && new Date(sub.trial_ends_at).getTime() > now;

  const hasAccess = isAdmin || isSuperAdmin || !!proActive || !!trialActive;
  const reason: AccessInfo["reason"] = isAdmin || isSuperAdmin
    ? "admin"
    : proActive
      ? "pro"
      : trialActive
        ? "trial"
        : "expired";

  return {
    hasAccess,
    tier: (sub?.tier as "free" | "pro") ?? "free",
    trialEndsAt: sub?.trial_ends_at ?? null,
    proEndsAt: sub?.pro_ends_at ?? null,
    isAdmin,
    isSuperAdmin,
    reason,
  };
}

export async function assertAccess(userId: string) {
  const a = await loadAccess(userId);
  if (!a.hasAccess) {
    throw new Error(
      "Akun Anda tidak aktif. Upgrade ke Pro agar scanner bisa dijalankan kembali.",
    );
  }
}

export async function assertAccessWithClient(
  supabase: { rpc: (fn: "has_active_access", args: { _user_id: string }) => PromiseLike<{ data: boolean | null; error: { message: string } | null }> },
  userId: string,
) {
  const { data, error } = await supabase.rpc("has_active_access", { _user_id: userId });
  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "Akun Anda tidak aktif. Upgrade ke Pro agar scanner bisa dijalankan kembali.",
    );
  }
}

export async function assertAdminOrSuper(userId: string) {
  // Cek support agent via email
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (SUPPORT_AGENT_EMAILS.includes(userData?.user?.email ?? "")) return;

  // Cek admin/super_admin via user_roles
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden");
}

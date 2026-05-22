import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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

async function loadAccess(userId: string): Promise<AccessInfo> {
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

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadAccess(context.userId));

export async function assertAccess(userId: string) {
  const a = await loadAccess(userId);
  if (!a.hasAccess) {
    throw new Error(
      "Akun Anda tidak aktif. Upgrade ke Pro agar scanner bisa dijalankan kembali.",
    );
  }
}

async function assertAdminOrSuper(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"])
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const adminExtendSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; action: "extend_6" | "extend_12" | "set_trial_14" | "deactivate" }) =>
    z
      .object({
        user_id: z.string().uuid(),
        action: z.enum(["extend_6", "extend_12", "set_trial_14", "deactivate"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.userId);

    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", data.user_id)
      .maybeSingle();

    const now = new Date();
    const base =
      existing?.pro_ends_at && new Date(existing.pro_ends_at) > now
        ? new Date(existing.pro_ends_at)
        : now;

    let row: {
      user_id: string;
      tier: "free" | "pro";
      pro_ends_at: string | null;
      trial_ends_at: string | null;
    } = {
      user_id: data.user_id,
      tier: existing?.tier ?? "free",
      pro_ends_at: existing?.pro_ends_at ?? null,
      trial_ends_at: existing?.trial_ends_at ?? null,
    };

    if (data.action === "extend_6") {
      const end = new Date(base);
      end.setMonth(end.getMonth() + 6);
      row.tier = "pro";
      row.pro_ends_at = end.toISOString();
    } else if (data.action === "extend_12") {
      const end = new Date(base);
      end.setMonth(end.getMonth() + 12);
      row.tier = "pro";
      row.pro_ends_at = end.toISOString();
    } else if (data.action === "set_trial_14") {
      const end = new Date(now);
      end.setDate(end.getDate() + 14);
      row.trial_ends_at = end.toISOString();
    } else if (data.action === "deactivate") {
      row.tier = "free";
      row.pro_ends_at = null;
      row.trial_ends_at = null;
    }

    const { error } = await supabaseAdmin
      .from("subscriptions")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, subscription: row };
  });

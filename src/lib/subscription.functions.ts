// access.server.ts — FULL FILE WITH CHANGES

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdminOrSuper, type AccessInfo } from "./subscription.server";
export type { AccessInfo };

// ─── HARDCODED SUPPORT AGENTS ────────────────────────────────────────────────
const SUPPORT_AGENT_EMAILS = ["setyanugroho44@gmail.com", "myadhi70@yahoo.com"];

// Deteksi support agent dari email pada JWT claims (tidak butuh service role key),
// agar tetap bekerja di deployment custom domain (Cloudflare) maupun preview.
function isSupportAgentClaimEmail(email: string | null | undefined): boolean {
  return SUPPORT_AGENT_EMAILS.includes((email ?? "").trim().toLowerCase());
}
// ─────────────────────────────────────────────────────────────────────────────

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: roles }, { data: sub }] = await Promise.all([
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
      context.supabase
        .from("subscriptions")
        .select("tier, trial_ends_at, pro_ends_at")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

    const isAdmin = !!roles?.some((r) => r.role === "admin");
    const isSuperAdmin = !!roles?.some((r) => r.role === "super_admin");
    const isSupportAgent = isSupportAgentClaimEmail(
      context.claims?.email as string | undefined,
    );

    const now = Date.now();
    const proActive =
      sub?.tier === "pro" && sub.pro_ends_at && new Date(sub.pro_ends_at).getTime() > now;
    const trialActive = sub?.trial_ends_at && new Date(sub.trial_ends_at).getTime() > now;

    const reason: AccessInfo["reason"] =
      isAdmin || isSuperAdmin ? "admin" : proActive ? "pro" : trialActive ? "trial" : "expired";

    return {
      hasAccess: isAdmin || isSuperAdmin || !!proActive || !!trialActive,
      tier: (sub?.tier as "free" | "pro") ?? "free",
      trialEndsAt: sub?.trial_ends_at ?? null,
      proEndsAt: sub?.pro_ends_at ?? null,
      isAdmin,
      isSuperAdmin,
      isSupportAgent, // ← tambahan
      reason,
    };
  });

export const adminExtendSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      user_id: string;
      action: "extend_1" | "extend_6" | "extend_12" | "set_trial_14" | "deactivate";
    }) =>
      z
        .object({
          user_id: z.string().uuid(),
          action: z.enum(["extend_1", "extend_6", "extend_12", "set_trial_14", "deactivate"]),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    // ← ganti assertAdminOrSuper → izinkan support agent juga (deteksi via JWT claims email)
    const isSupport = isSupportAgentClaimEmail(context.claims?.email as string | undefined);
    if (!isSupport) {
      await assertAdminOrSuper(context.userId); // tetap cek admin/super jika bukan support
    }

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

    const row: {
      user_id: string;
      tier: "free" | "pro";
      pro_ends_at: string | null;
      trial_ends_at: string | null;
    } = {
      user_id: data.user_id,
      tier: (existing?.tier as "free" | "pro") ?? "free",
      pro_ends_at: existing?.pro_ends_at ?? null,
      trial_ends_at: existing?.trial_ends_at ?? null,
    };

    if (data.action === "extend_1") {
      const end = new Date(base);
      end.setMonth(end.getMonth() + 1);
      row.tier = "pro";
      row.pro_ends_at = end.toISOString();
    } else if (data.action === "extend_6") {
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

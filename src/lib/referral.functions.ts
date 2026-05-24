import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getMyReferralStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count } = await supabaseAdmin
      .from("referrals")
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", context.userId);
    return { code: context.userId, count: count ?? 0 };
  });

// Called right after a new user signs up, from the client, using their freshly-issued session.
export const applyReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { referrer_id: string }) =>
    z.object({ referrer_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.referrer_id === context.userId) {
      return { ok: false, reason: "self" as const };
    }

    // Ensure referrer exists
    const { data: refUser, error: refErr } = await supabaseAdmin.auth.admin.getUserById(
      data.referrer_id,
    );
    if (refErr || !refUser?.user) return { ok: false, reason: "invalid_referrer" as const };

    // Insert referral row; UNIQUE on referred_user_id prevents double-reward
    const { error: insErr } = await supabaseAdmin
      .from("referrals")
      .insert({ referrer_id: data.referrer_id, referred_user_id: context.userId });
    if (insErr) {
      if (insErr.message.toLowerCase().includes("duplicate")) {
        return { ok: false, reason: "already_referred" as const };
      }
      throw new Error(insErr.message);
    }

    // Extend referrer subscription by 14 days (works for both free trial & pro)
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("tier, trial_ends_at, pro_ends_at")
      .eq("user_id", data.referrer_id)
      .maybeSingle();

    const now = new Date();
    const addDays = (d: Date, n: number) => {
      const r = new Date(d);
      r.setDate(r.getDate() + n);
      return r;
    };

    const tier = (sub?.tier as "free" | "pro") ?? "free";
    let trial_ends_at = sub?.trial_ends_at ?? null;
    let pro_ends_at = sub?.pro_ends_at ?? null;

    if (tier === "pro" && pro_ends_at && new Date(pro_ends_at) > now) {
      pro_ends_at = addDays(new Date(pro_ends_at), 14).toISOString();
    } else {
      const base = trial_ends_at && new Date(trial_ends_at) > now ? new Date(trial_ends_at) : now;
      trial_ends_at = addDays(base, 14).toISOString();
    }

    const { error: upErr } = await supabaseAdmin.from("subscriptions").upsert(
      { user_id: data.referrer_id, tier, trial_ends_at, pro_ends_at },
      { onConflict: "user_id" },
    );
    if (upErr) throw new Error(upErr.message);

    return { ok: true, extended_days: 14 };
  });

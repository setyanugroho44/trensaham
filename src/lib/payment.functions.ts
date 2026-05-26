import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdminOrSuper } from "./subscription.server";

const PLANS = {
  pro_6m: { base: 119000, months: 6, label: "Pro 6 Bulan" },
  pro_12m: { base: 199000, months: 12, label: "Pro 12 Bulan" },
} as const;

export type PlanKey = keyof typeof PLANS;

export const createPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan: PlanKey }) =>
    z.object({ plan: z.enum(["pro_6m", "pro_12m"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await supabaseAdmin
      .from("payment_requests")
      .select("*")
      .eq("user_id", context.userId)
      .eq("plan", data.plan)
      .in("status", ["pending", "submitted"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) return { request: existing };

    const plan = PLANS[data.plan];
    const uniqueCode = Math.floor(Math.random() * 900) + 100;
    const totalAmount = plan.base + uniqueCode;

    const { data: row, error } = await supabaseAdmin
      .from("payment_requests")
      .insert({
        user_id: context.userId,
        plan: data.plan,
        base_amount: plan.base,
        unique_code: uniqueCode,
        total_amount: totalAmount,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { request: row };
  });

export const markPaymentSubmitted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; proof_url: string }) =>
    z.object({ id: z.string().uuid(), proof_url: z.string().min(1).max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("payment_requests")
      .update({ proof_url: data.proof_url, status: "submitted" })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("payment_requests")
      .update({ status: "cancelled" })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .in("status", ["pending", "submitted"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyPaymentRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("payment_requests")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { requests: data ?? [] };
  });

export const adminListPaymentRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrSuper(context.userId);
    const { data, error } = await supabaseAdmin
      .from("payment_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const userIds = Array.from(new Set((data ?? []).map((r) => r.user_id)));
    let emails: Record<string, string> = {};
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const nameMap = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name]));
      for (const uid of userIds) {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
        emails[uid] = u?.user?.email ?? nameMap.get(uid) ?? uid.slice(0, 8);
      }
    }
    return { requests: (data ?? []).map((r) => ({ ...r, email: emails[r.user_id] ?? null })) };
  });

export const adminGetProofUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string }) =>
    z.object({ path: z.string().min(1).max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.userId);
    const { data: signed, error } = await supabaseAdmin.storage
      .from("payment-proofs")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null };
  });

export const adminApprovePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.userId);
    const { data: req, error: e1 } = await supabaseAdmin
      .from("payment_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!req) throw new Error("Request not found");
    if (req.status === "approved") return { ok: true };

    const plan = PLANS[req.plan as PlanKey];
    if (!plan) throw new Error("Unknown plan");

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", req.user_id)
      .maybeSingle();

    const now = new Date();
    const base = sub?.pro_ends_at && new Date(sub.pro_ends_at) > now ? new Date(sub.pro_ends_at) : now;
    const end = new Date(base);
    end.setMonth(end.getMonth() + plan.months);

    const { error: e2 } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: req.user_id,
        tier: "pro",
        pro_ends_at: end.toISOString(),
        trial_ends_at: sub?.trial_ends_at ?? null,
      },
      { onConflict: "user_id" },
    );
    if (e2) throw new Error(e2.message);

    const { error: e3 } = await supabaseAdmin
      .from("payment_requests")
      .update({ status: "approved", verified_by: context.userId, verified_at: now.toISOString() })
      .eq("id", data.id);
    if (e3) throw new Error(e3.message);
    return { ok: true };
  });

export const adminRejectPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; note?: string }) =>
    z.object({ id: z.string().uuid(), note: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrSuper(context.userId);
    const { error } = await supabaseAdmin
      .from("payment_requests")
      .update({
        status: "rejected",
        admin_note: data.note ?? null,
        verified_by: context.userId,
        verified_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

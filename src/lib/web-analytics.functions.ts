import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const visitSchema = z.object({
  source_type: z.enum(["search", "referral", "direct"]).default("direct"),
  referrer_url: z.string().max(2000).nullable().optional(),
  referrer_domain: z.string().max(255).nullable().optional(),
  search_engine: z.string().max(100).nullable().optional(),
  search_keyword: z.string().max(500).nullable().optional(),
  landing_path: z.string().max(500).nullable().optional(),
  utm_source: z.string().max(255).nullable().optional(),
  utm_medium: z.string().max(255).nullable().optional(),
  utm_campaign: z.string().max(255).nullable().optional(),
  utm_term: z.string().max(255).nullable().optional(),
  user_agent: z.string().max(500).nullable().optional(),
});

/**
 * Public, unauthenticated endpoint used by the visit tracker on public pages.
 * Records where a visitor came from (search engine + keyword, or referring site).
 */
export const recordVisit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => visitSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("web_visits").insert({
      source_type: data.source_type,
      referrer_url: data.referrer_url ?? null,
      referrer_domain: data.referrer_domain ?? null,
      search_engine: data.search_engine ?? null,
      search_keyword: data.search_keyword ?? null,
      landing_path: data.landing_path ?? null,
      utm_source: data.utm_source ?? null,
      utm_medium: data.utm_medium ?? null,
      utm_campaign: data.utm_campaign ?? null,
      utm_term: data.utm_term ?? null,
      user_agent: data.user_agent ?? null,
    });
    if (error) {
      console.error("[recordVisit] insert failed", { error: error.message });
      return { ok: false as const };
    }
    return { ok: true as const };
  });

type WebVisitRow = {
  created_at: string;
  source_type: string | null;
  referrer_url: string | null;
  referrer_domain: string | null;
  search_engine: string | null;
  search_keyword: string | null;
  landing_path: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
};

async function requireAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: admin only");
}

const rangeSchema = z.object({ days: z.number().int().min(1).max(365).default(30) });

export const adminGetWebAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => rangeSchema.parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("web_visits")
      .select(
        "created_at, source_type, referrer_url, referrer_domain, search_engine, search_keyword, landing_path, utm_source, utm_campaign",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20000);

    if (error) throw new Error(error.message);

    const visits = (rows ?? []) as WebVisitRow[];

    const total = visits.length;
    const bySource = { search: 0, referral: 0, direct: 0 } as Record<string, number>;
    const keywordMap = new Map<string, number>();
    const engineMap = new Map<string, number>();
    const referrerMap = new Map<string, number>();
    const campaignMap = new Map<string, number>();
    const dayMap = new Map<string, number>();

    for (const v of visits) {
      const src = v.source_type ?? "direct";
      bySource[src] = (bySource[src] ?? 0) + 1;

      if (v.search_keyword) {
        const k = v.search_keyword.trim().toLowerCase();
        if (k) keywordMap.set(k, (keywordMap.get(k) ?? 0) + 1);
      }
      if (v.search_engine) {
        engineMap.set(v.search_engine, (engineMap.get(v.search_engine) ?? 0) + 1);
      }
      if (src === "referral" && v.referrer_domain) {
        referrerMap.set(v.referrer_domain, (referrerMap.get(v.referrer_domain) ?? 0) + 1);
      }
      if (v.utm_campaign) {
        campaignMap.set(v.utm_campaign, (campaignMap.get(v.utm_campaign) ?? 0) + 1);
      }
      const day = (v.created_at ?? "").slice(0, 10);
      if (day) dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    }

    const toSorted = (m: Map<string, number>, limit = 25) =>
      Array.from(m.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

    const daily = Array.from(dayMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const recent = visits.slice(0, 50).map((v) => ({
      created_at: v.created_at,
      source_type: v.source_type ?? "direct",
      search_engine: v.search_engine,
      search_keyword: v.search_keyword,
      referrer_domain: v.referrer_domain,
      landing_path: v.landing_path,
    }));

    return {
      total,
      bySource,
      keywords: toSorted(keywordMap),
      engines: toSorted(engineMap),
      referrers: toSorted(referrerMap),
      campaigns: toSorted(campaignMap),
      daily,
      recent,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: admin only");
}

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .in("role", ["admin", "super_admin"]);
    return { isAdmin: (data?.length ?? 0) > 0 };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const all: Array<{ id: string; email: string | undefined; created_at: string; last_sign_in_at: string | null }> = [];
    let page = 1;
    // paginate auth.users
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        all.push({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
      if (data.users.length < 200) break;
      page += 1;
      if (page > 25) break;
    }

    const ids = all.map((u) => u.id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, address, phone")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("user_id, tier, trial_ends_at, pro_ends_at")
      .in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const pMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const sMap = new Map((subs ?? []).map((s) => [s.user_id, s]));
    const rMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rMap.set(r.user_id, arr);
    }

    return {
      users: all.map((u) => ({
        ...u,
        full_name: pMap.get(u.id)?.full_name ?? null,
        address: pMap.get(u.id)?.address ?? null,
        phone: pMap.get(u.id)?.phone ?? null,
        roles: rMap.get(u.id) ?? [],
        tier: (sMap.get(u.id)?.tier as "free" | "pro") ?? "free",
        trial_ends_at: sMap.get(u.id)?.trial_ends_at ?? null,
        pro_ends_at: sMap.get(u.id)?.pro_ends_at ?? null,
      })),
    };
  });

export const adminUpdateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; full_name?: string | null; address?: string | null; phone?: string | null }) =>
    z
      .object({
        user_id: z.string().uuid(),
        full_name: z.string().max(200).nullable().optional(),
        address: z.string().max(1000).nullable().optional(),
        phone: z.string().max(50).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("profiles").upsert(
      {
        user_id: data.user_id,
        full_name: data.full_name ?? null,
        address: data.address ?? null,
        phone: data.phone ?? null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string }) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) throw new Error("Tidak bisa menghapus akun sendiri");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CmsSection = { id: string; heading: string; content: string };
export type CmsPage = {
  id: string;
  slug: string;
  title: string;
  visibility: "public" | "private";
  sections: CmsSection[];
  updated_at: string;
};

const sectionSchema = z.object({
  id: z.string().min(1).max(64),
  heading: z.string().max(200).default(""),
  content: z.string().max(50000).default(""),
});

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "super_admin"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Forbidden: admin only");
}

// Public — only returns public pages (safe for anon)
export const getPublicPage = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("cms_pages")
      .select("id, slug, title, visibility, sections, updated_at")
      .eq("slug", data.slug)
      .eq("visibility", "public")
      .limit(1);
    if (error) throw new Error(error.message);
    return { page: (row?.[0] as CmsPage | undefined) ?? null };
  });

// Authenticated — returns public OR private
export const getPageForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("cms_pages")
      .select("id, slug, title, visibility, sections, updated_at")
      .eq("slug", data.slug)
      .limit(1);
    if (error) throw new Error(error.message);
    return { page: (row?.[0] as CmsPage | undefined) ?? null };
  });

export const adminListPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("cms_pages")
      .select("id, slug, title, visibility, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { pages: data ?? [] };
  });

export const adminGetPage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("cms_pages")
      .select("id, slug, title, visibility, sections, updated_at")
      .eq("slug", data.slug)
      .limit(1);
    if (error) throw new Error(error.message);
    return { page: (row?.[0] as CmsPage | undefined) ?? null };
  });

export const adminUpsertPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      slug: string;
      title: string;
      visibility: "public" | "private";
      sections: CmsSection[];
    }) =>
      z
        .object({
          slug: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-z0-9-]+$/, "Hanya huruf kecil, angka, dan tanda hubung"),
          title: z.string().min(1).max(200),
          visibility: z.enum(["public", "private"]),
          sections: z.array(sectionSchema).max(50),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("cms_pages")
      .upsert(
        {
          slug: data.slug,
          title: data.title,
          visibility: data.visibility,
          sections: data.sections,
        },
        { onConflict: "slug" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeletePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.slug === "landing") throw new Error("Halaman 'landing' tidak boleh dihapus");
    const { error } = await supabaseAdmin.from("cms_pages").delete().eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

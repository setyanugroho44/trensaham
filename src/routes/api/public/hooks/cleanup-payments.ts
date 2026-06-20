import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled cleanup (called by pg_cron) that deletes payment requests older
 * than 18 months together with their uploaded transfer proofs in storage.
 * Protected by the shared secret stored in `app_config`.
 */
export const Route = (createFileRoute("/api/public/hooks/cleanup-payments") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const provided = request.headers.get("x-notify-secret") ?? "";
        const { data: cfg, error: cfgError } = await supabaseAdmin
          .from("app_config")
          .select("value")
          .eq("key", "notify_signup_secret")
          .maybeSingle();

        if (cfgError || !cfg?.value || provided !== cfg.value) {
          return new Response("Unauthorized", { status: 401 });
        }

        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 18);

        const { data: rows, error: selErr } = await supabaseAdmin
          .from("payment_requests")
          .select("id, proof_url")
          .lt("created_at", cutoff.toISOString());

        if (selErr) {
          console.error("[cleanup-payments] select failed:", selErr.message);
          return new Response("Select error", { status: 500 });
        }

        if (!rows || rows.length === 0) {
          return Response.json({ ok: true, deleted: 0, files: 0 });
        }

        const proofPaths = rows
          .map((r) => r.proof_url)
          .filter((p): p is string => !!p);

        if (proofPaths.length > 0) {
          const { error: storageErr } = await supabaseAdmin.storage
            .from("payment-proofs")
            .remove(proofPaths);
          if (storageErr) {
            console.error("[cleanup-payments] storage remove failed:", storageErr.message);
          }
        }

        const ids = rows.map((r) => r.id);
        const { error: delErr } = await supabaseAdmin
          .from("payment_requests")
          .delete()
          .in("id", ids);

        if (delErr) {
          console.error("[cleanup-payments] delete failed:", delErr.message);
          return new Response("Delete error", { status: 500 });
        }

        return Response.json({ ok: true, deleted: ids.length, files: proofPaths.length });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

const payloadSchema = z.object({
  email: z.string().email().max(320),
  user_id: z.string().uuid().optional(),
});

/**
 * Public webhook called by the `handle_new_user` database trigger (via pg_net)
 * whenever a new account is created. Protected by a shared secret stored in
 * the `app_config` table so only the trigger can reach it. Sends a Telegram
 * notification to the admin chat.
 */
export const Route = (createFileRoute("/api/public/notify-signup") as any)({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const provided = request.headers.get("x-notify-secret") ?? "";

        const { data: cfg, error: cfgError } = await supabaseAdmin
          .from("app_config")
          .select("value")
          .eq("key", "notify_signup_secret")
          .maybeSingle();

        if (cfgError || !cfg?.value || provided !== cfg.value) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) {
          return new Response("Invalid payload", { status: 400 });
        }

        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
        const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

        if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY || !TELEGRAM_CHAT_ID) {
          console.error("[notify-signup] Missing Telegram configuration");
          return new Response("Server not configured", { status: 500 });
        }

        const text =
          `🆕 <b>Pendaftaran baru</b>\n` +
          `Email: <code>${parsed.data.email}</code>\n` +
          `Waktu: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`;

        try {
          const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": TELEGRAM_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chat_id: TELEGRAM_CHAT_ID,
              text,
              parse_mode: "HTML",
            }),
          });

          if (!res.ok) {
            const errBody = await res.text();
            console.error(`[notify-signup] Telegram error [${res.status}]: ${errBody}`);
            return new Response("Telegram error", { status: 502 });
          }
        } catch (error) {
          console.error("[notify-signup] request failed:", error);
          return new Response("Telegram request failed", { status: 502 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});

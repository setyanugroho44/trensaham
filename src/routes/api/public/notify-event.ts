import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

const PLAN_LABELS: Record<string, string> = {
  pro_6m: "Pro 6 Bulan",
  pro_12m: "Pro 12 Bulan",
  pro_1m: "Pro 1 Bulan",
};

const payloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("support"),
    email: z.string().max(320).nullable().optional(),
    subject: z.string().max(300).nullable().optional(),
    body: z.string().max(4000).nullable().optional(),
  }),
  z.object({
    type: z.literal("payment"),
    email: z.string().max(320).nullable().optional(),
    plan: z.string().max(50).nullable().optional(),
    amount: z.number().nullable().optional(),
  }),
]);

function rupiah(n: number) {
  return "Rp" + n.toLocaleString("id-ID");
}

function nowWib() {
  return new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) + " WIB";
}

/**
 * Public webhook called by database triggers (via pg_net) when a new support
 * message is posted by a user, or when a payment/upgrade request is submitted.
 * Runs on the stable Lovable URL so the Telegram secrets are always available,
 * even when the app is served from a custom Cloudflare domain. Protected by the
 * shared secret stored in `app_config`.
 */
export const Route = (createFileRoute("/api/public/notify-event") as any)({
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
          console.error("[notify-event] Missing Telegram configuration");
          return new Response("Server not configured", { status: 500 });
        }

        const email = parsed.data.email || "pengguna";
        let text: string;

        if (parsed.data.type === "support") {
          text =
            `🎫 <b>Pertanyaan support baru</b>\n` +
            `Dari: <code>${email}</code>\n` +
            (parsed.data.subject ? `Subjek: ${parsed.data.subject}\n` : "") +
            (parsed.data.body ? `Pesan: ${parsed.data.body.slice(0, 500)}\n` : "") +
            `Waktu: ${nowWib()}`;
        } else {
          const planLabel = parsed.data.plan
            ? PLAN_LABELS[parsed.data.plan] ?? parsed.data.plan
            : "-";
          text =
            `💳 <b>Permintaan upgrade keanggotaan</b>\n` +
            `Dari: <code>${email}</code>\n` +
            `Paket: ${planLabel}\n` +
            (parsed.data.amount ? `Jumlah: ${rupiah(parsed.data.amount)}\n` : "") +
            `Status: bukti pembayaran diunggah, menunggu verifikasi\n` +
            `Waktu: ${nowWib()}`;
        }

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
            console.error(`[notify-event] Telegram error [${res.status}]: ${errBody}`);
            return new Response("Telegram error", { status: 502 });
          }
        } catch (error) {
          console.error("[notify-event] request failed:", error);
          return new Response("Telegram request failed", { status: 502 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});

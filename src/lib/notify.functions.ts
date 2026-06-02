import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

const inputSchema = z.object({
  email: z.string().email().max(320),
});

/**
 * Sends a Telegram notification to the configured admin chat whenever a new
 * user registers. Fire-and-forget from the client; failures are swallowed so
 * they never block the signup flow.
 */
export const notifyNewSignup = createServerFn({ method: "POST" })
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
    const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

    if (!LOVABLE_API_KEY) {
      console.error("[notifyNewSignup] LOVABLE_API_KEY is not configured");
      return { ok: false };
    }
    if (!TELEGRAM_API_KEY) {
      console.error("[notifyNewSignup] TELEGRAM_API_KEY is not configured");
      return { ok: false };
    }
    if (!TELEGRAM_CHAT_ID) {
      console.error("[notifyNewSignup] TELEGRAM_CHAT_ID is not configured");
      return { ok: false };
    }

    const text =
      `🆕 <b>Pendaftaran baru</b>\n` +
      `Email: <code>${data.email}</code>\n` +
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
        const body = await res.text();
        console.error(`[notifyNewSignup] Telegram error [${res.status}]: ${body}`);
        return { ok: false };
      }
      return { ok: true };
    } catch (error) {
      console.error("[notifyNewSignup] request failed:", error);
      return { ok: false };
    }
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPPORT_AGENT_EMAILS = ["setyanugroho44@gmail.com", "myadhi70@yahoo.com"];

function isAgentEmail(email: string | null | undefined): boolean {
  return SUPPORT_AGENT_EMAILS.includes((email ?? "").trim().toLowerCase());
}

export type TicketStatus = "open" | "closed";

export type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  user_email?: string | null;
};

export type TicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  is_agent: boolean;
  created_at: string;
};

export const amISupportAgent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { isAgent: isAgentEmail(context.claims?.email as string | undefined) };
  });

export const listTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, claims } = context;
    const isAgent = isAgentEmail(claims?.email as string | undefined);

    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, user_id, subject, status, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    let tickets = (data ?? []) as Ticket[];

    // For the agent, enrich with the reporter's email for context.
    if (isAgent && tickets.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const emailMap = new Map<string, string | null>();
      const ids = Array.from(new Set(tickets.map((t) => t.user_id)));
      await Promise.all(
        ids.map(async (id) => {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
          emailMap.set(id, u?.user?.email ?? null);
        }),
      );
      tickets = tickets.map((t) => ({ ...t, user_email: emailMap.get(t.user_id) ?? null }));
    }

    return { tickets, isAgent };
  });

export const getTicket = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticketId: string }) =>
    z.object({ ticketId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .select("id, user_id, subject, status, created_at, updated_at")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!ticket) throw new Error("Tiket tidak ditemukan");

    const { data: messages, error: mErr } = await supabase
      .from("support_messages")
      .select("id, ticket_id, sender_id, body, is_agent, created_at")
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: true });
    if (mErr) throw new Error(mErr.message);

    return { ticket: ticket as Ticket, messages: (messages ?? []) as TicketMessage[] };
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { subject: string; body: string }) =>
    z
      .object({
        subject: z.string().trim().min(3).max(150),
        body: z.string().trim().min(3).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ticket, error: tErr } = await supabase
      .from("support_tickets")
      .insert({ user_id: userId, subject: data.subject, status: "open" })
      .select("id, user_id, subject, status, created_at, updated_at")
      .single();
    if (tErr) throw new Error(tErr.message);

    const { error: mErr } = await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: userId,
      body: data.body,
      is_agent: false,
    });
    if (mErr) throw new Error(mErr.message);

    // Telegram notification is sent by the DB trigger on support_messages
    // (notify_support_message -> /api/public/notify-event) so it works even on
    // the custom Cloudflare domain.

    return { ticket: ticket as Ticket };
  });

export const replyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticketId: string; body: string }) =>
    z
      .object({
        ticketId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const isAgent = isAgentEmail(claims?.email as string | undefined);

    const { error } = await supabase.from("support_messages").insert({
      ticket_id: data.ticketId,
      sender_id: userId,
      body: data.body,
      is_agent: isAgent,
    });
    if (error) throw new Error(error.message);

    // Re-open ticket if a user replies after it was closed.
    if (!isAgent) {
      await supabase
        .from("support_tickets")
        .update({ status: "open" })
        .eq("id", data.ticketId);
    }

    return { ok: true };
  });

export const setTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ticketId: string; status: TicketStatus }) =>
    z
      .object({
        ticketId: z.string().uuid(),
        status: z.enum(["open", "closed"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: data.status })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

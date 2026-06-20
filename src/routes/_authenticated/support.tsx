import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Send, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { getMyAccess } from "@/lib/subscription.functions";
import {
  amISupportAgent,
  listTickets,
  getTicket,
  createTicket,
  replyTicket,
  setTicketStatus,
  type Ticket,
  type TicketMessage,
} from "@/lib/support.functions";

export const Route = createFileRoute("/_authenticated/support")({
  component: SupportPage,
  head: () => ({ meta: [{ title: "Support — Tiket Bantuan" }] }),
});

function fmt(ts: string) {
  return new Date(ts).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function SupportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fnAccess = useServerFn(getMyAccess);
  const fnAmIAgent = useServerFn(amISupportAgent);
  const fnList = useServerFn(listTickets);
  const fnGet = useServerFn(getTicket);
  const fnCreate = useServerFn(createTicket);
  const fnReply = useServerFn(replyTicket);
  const fnSetStatus = useServerFn(setTicketStatus);

  const [allowed, setAllowed] = useState<boolean | null>(null);

  const [isAgent, setIsAgent] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // new ticket form
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // reply
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fnList();
      setTickets(res.tickets);
      setIsAgent(res.isAgent);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat tiket");
    } finally {
      setLoading(false);
    }
  }, [fnList]);

  useEffect(() => {
    let active = true;
    fnAccess()
      .then((access) => {
        if (!active) return;
        const isAgentOrAdmin =
          access.isAdmin || access.isSuperAdmin || (access.isSupportAgent ?? false);
        const ok = isAgentOrAdmin || access.reason !== "trial";
        setAllowed(ok);
        if (!ok) navigate({ to: "/dashboard" });
      })
      .catch(() => {
        if (active) setAllowed(true);
      });
    return () => {
      active = false;
    };
  }, [fnAccess, navigate]);

  useEffect(() => {
    if (allowed === false) return;
    fnAmIAgent().then((r) => setIsAgent(r.isAgent)).catch(() => {});
    loadList();
  }, [fnAmIAgent, loadList, allowed]);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openTicket = async (t: Ticket) => {
    setSelected(t);
    setMessages([]);
    try {
      const res = await fnGet({ data: { ticketId: t.id } });
      setSelected(res.ticket);
      setMessages(res.messages);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat tiket");
    }
  };

  const submitTicket = async () => {
    if (subject.trim().length < 3 || body.trim().length < 3) {
      toast.warning("Isi subjek dan pesan minimal 3 karakter");
      return;
    }
    setSubmitting(true);
    try {
      await fnCreate({ data: { subject: subject.trim(), body: body.trim() } });
      toast.success("Tiket terkirim. Tim kami akan membalas secepatnya.");
      setSubject("");
      setBody("");
      setCreating(false);
      await loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim tiket");
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async () => {
    if (!selected || reply.trim().length === 0) return;
    setReplying(true);
    try {
      await fnReply({ data: { ticketId: selected.id, body: reply.trim() } });
      setReply("");
      await openTicket(selected);
      await loadList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim balasan");
    } finally {
      setReplying(false);
    }
  };

  const toggleStatus = async () => {
    if (!selected) return;
    const next = selected.status === "open" ? "closed" : "open";
    try {
      await fnSetStatus({ data: { ticketId: selected.id, status: next } });
      setSelected({ ...selected, status: next });
      await loadList();
      toast.success(next === "closed" ? "Tiket ditutup" : "Tiket dibuka kembali");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memperbarui status");
    }
  };

  if (allowed === null) {
    return <p className="p-4 text-sm text-muted-foreground">Memuat…</p>;
  }
  if (allowed === false) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Halaman support hanya tersedia untuk member Pro. Upgrade akun Anda untuk mengakses bantuan.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Detail view

  if (selected) {
    return (
      <div className="mx-auto w-full max-w-3xl p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Kembali
          </Button>
          <Button variant="outline" size="sm" className="ml-auto" onClick={toggleStatus}>
            {selected.status === "open" ? (
              <>
                <CheckCircle2 className="mr-1 h-4 w-4" /> Tutup tiket
              </>
            ) : (
              <>
                <RotateCcw className="mr-1 h-4 w-4" /> Buka kembali
              </>
            )}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{selected.subject}</CardTitle>
              <Badge variant={selected.status === "open" ? "default" : "secondary"}>
                {selected.status === "open" ? "Terbuka" : "Ditutup"}
              </Badge>
            </div>
            <CardDescription>Dibuat {fmt(selected.created_at)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.is_agent ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.is_agent ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
                  }`}
                >
                  <div className="mb-1 text-xs opacity-70">
                    {m.is_agent ? "Tim Support" : "Anda"} · {fmt(m.created_at)}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 pt-6">
            <Textarea
              placeholder="Tulis balasan…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end">
              <Button onClick={sendReply} disabled={replying || reply.trim().length === 0}>
                <Send className="mr-1 h-4 w-4" /> {replying ? "Mengirim…" : "Kirim balasan"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // List view
  return (
    <div className="mx-auto w-full max-w-3xl p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">Tiket Bantuan</h1>
          <p className="text-sm text-muted-foreground">
            {isAgent
              ? "Anda adalah agen support — semua tiket pengguna tampil di sini."
              : "Kirim pertanyaan atau kendala Anda, tim kami akan membalas."}
          </p>
        </div>
        {!isAgent && (
          <Button
            className="w-full shrink-0 sm:ml-auto sm:w-auto"
            onClick={() => setCreating((v) => !v)}
          >
            <Plus className="mr-1 h-4 w-4" /> Tiket baru
          </Button>
        )}
      </div>

      {creating && !isAgent && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buat tiket baru</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Subjek"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={150}
            />
            <Textarea
              placeholder="Jelaskan pertanyaan atau masalah Anda…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={4000}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Batal
              </Button>
              <Button onClick={submitTicket} disabled={submitting}>
                {submitting ? "Mengirim…" : "Kirim tiket"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat…</p>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Belum ada tiket.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => openTicket(t)}
              className="w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.subject}</span>
                <Badge variant={t.status === "open" ? "default" : "secondary"}>
                  {t.status === "open" ? "Terbuka" : "Ditutup"}
                </Badge>
                <span className="ml-auto text-xs text-muted-foreground">{fmt(t.updated_at)}</span>
              </div>
              {isAgent && t.user_email && (
                <div className="mt-1 text-xs text-muted-foreground">{t.user_email}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

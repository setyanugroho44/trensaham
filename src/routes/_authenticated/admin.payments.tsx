import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminListPaymentRequests,
  adminApprovePayment,
  adminRejectPayment,
  adminGetProofUrl,
} from "@/lib/payment.functions";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  component: AdminPaymentsPage,
});

type Row = {
  id: string;
  user_id: string;
  email: string | null;
  plan: "pro_6m" | "pro_12m";
  base_amount: number;
  unique_code: number;
  total_amount: number;
  proof_url: string | null;
  status: "pending" | "submitted" | "approved" | "rejected" | "cancelled";
  admin_note: string | null;
  created_at: string;
};

function AdminPaymentsPage() {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const listFn = useServerFn(adminListPaymentRequests);
  const approveFn = useServerFn(adminApprovePayment);
  const rejectFn = useServerFn(adminRejectPayment);
  const proofFn = useServerFn(adminGetProofUrl);

  useEffect(() => {
    isCurrentUserAdmin()
      .then(({ isAdmin }) => {
        setAllowed(isAdmin);
        if (!isAdmin) navigate({ to: "/dashboard" });
      })
      .catch(() => setAllowed(false));
  }, [navigate]);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await listFn();
      setRows(r.requests as Row[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) reload();
  }, [allowed]);

  const onApprove = async (r: Row) => {
    if (!confirm(`Setujui pembayaran ${r.email ?? r.user_id} untuk ${r.plan}?`)) return;
    setBusyId(r.id);
    try {
      await approveFn({ data: { id: r.id } });
      toast.success("Pembayaran disetujui dan langganan diperpanjang.");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const onReject = async (r: Row) => {
    const note = prompt("Alasan penolakan (opsional):") ?? undefined;
    setBusyId(r.id);
    try {
      await rejectFn({ data: { id: r.id, note } });
      toast.success("Pembayaran ditolak.");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const onViewProof = async (r: Row) => {
    if (!r.proof_url) return;
    try {
      const { url } = await proofFn({ data: { path: r.proof_url } });
      if (url) window.open(url, "_blank");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (allowed === null) return <div className="p-6 text-sm text-muted-foreground">Memeriksa akses…</div>;
  if (!allowed) return null;

  const pending = rows.filter((r) => r.status === "submitted" || r.status === "pending");
  const others = rows.filter((r) => r.status !== "submitted" && r.status !== "pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verifikasi Pembayaran</h1>
        <p className="text-sm text-muted-foreground">Setujui atau tolak pembayaran upgrade Pro.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Menunggu Verifikasi ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada pembayaran menunggu.</p>
          ) : (
            <PaymentTable rows={pending} busyId={busyId} onApprove={onApprove} onReject={onReject} onViewProof={onViewProof} actions />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat ({others.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentTable rows={others} busyId={null} onApprove={onApprove} onReject={onReject} onViewProof={onViewProof} />
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentTable({
  rows,
  busyId,
  onApprove,
  onReject,
  onViewProof,
  actions,
}: {
  rows: Row[];
  busyId: string | null;
  onApprove: (r: Row) => void;
  onReject: (r: Row) => void;
  onViewProof: (r: Row) => void;
  actions?: boolean;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  return (
    <>
      {/* Mobile: stacked 2-row cards */}
      <div className="space-y-3 sm:hidden">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.email ?? r.user_id.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString("id-ID")}
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">{r.status}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span>{r.plan === "pro_6m" ? "6 bulan" : "12 bulan"}</span>
              <span className="font-mono">Rp {new Intl.NumberFormat("id-ID").format(r.total_amount)}</span>
              {r.proof_url && (
                <button className="text-primary underline" onClick={() => onViewProof(r)}>
                  Lihat bukti
                </button>
              )}
            </div>
            {actions && (
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => onApprove(r)} disabled={busyId === r.id}>
                  {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Setujui"}
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => onReject(r)} disabled={busyId === r.id}>
                  Tolak
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Tanggal</th>
              <th className="py-2">User</th>
              <th className="py-2">Paket</th>
              <th className="py-2">Total</th>
              <th className="py-2">Status</th>
              <th className="py-2">Bukti</th>
              {actions && <th className="py-2">Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-2">{new Date(r.created_at).toLocaleString("id-ID")}</td>
                <td className="py-2">{r.email ?? r.user_id.slice(0, 8)}</td>
                <td className="py-2">{r.plan === "pro_6m" ? "6 bulan" : "12 bulan"}</td>
                <td className="py-2 font-mono">{new Intl.NumberFormat("id-ID").format(r.total_amount)}</td>
                <td className="py-2"><Badge variant="secondary">{r.status}</Badge></td>
                <td className="py-2">
                  {r.proof_url ? (
                    <button className="text-primary underline" onClick={() => onViewProof(r)}>Lihat</button>
                  ) : (
                    "—"
                  )}
                </td>
                {actions && (
                  <td className="py-2">
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => onApprove(r)} disabled={busyId === r.id}>
                        {busyId === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Setujui"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onReject(r)} disabled={busyId === r.id}>
                        Tolak
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}


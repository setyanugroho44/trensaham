import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  createPaymentRequest,
  listMyPaymentRequests,
  markPaymentSubmitted,
  cancelPaymentRequest,
  type PlanKey,
} from "@/lib/payment.functions";
import { getMyAccess, type AccessInfo } from "@/lib/subscription.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Check, Copy, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/upgrade")({
  component: UpgradePage,
  head: () => ({ meta: [{ title: "Upgrade ke Pro — Analisa Saham Indo" }] }),
});

type PaymentRow = {
  id: string;
  plan: "pro_2m" | "pro_6m" | "pro_12m";
  base_amount: number;
  unique_code: number;
  total_amount: number;
  proof_url: string | null;
  status: "pending" | "submitted" | "approved" | "rejected" | "cancelled";
  admin_note: string | null;
  created_at: string;
};

const PLAN_META: Record<PlanKey, { label: string; price: string; months: number; perks: string[] }> = {
  pro_2m: {
    label: "Pro 2 Bulan",
    price: "Rp 48.000",
    months: 2,
    perks: ["Akses scanner penuh", "50 watchlist saham", "Support"],
  },
  pro_6m: {
    label: "Pro 6 Bulan",
    price: "Rp 120.000",
    months: 6,
    perks: ["Akses scanner penuh", "50 watchlist", "Prioritas Support"],
  },
  pro_12m: {
    label: "Pro 12 Bulan",
    price: "Rp 200.000",
    months: 12,
    perks: ["Hemat ~17% vs 6 bulan", "Akses scanner penuh", "Prioritas support"],
  },
};

const BANK = { name: "BCA", number: "4340030333", holder: "Setya Adhi N" };

function formatIDR(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} disalin`),
    () => toast.error("Gagal menyalin"),
  );
}

function UpgradePage() {
  const { user } = useAuth();
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [requests, setRequests] = useState<PaymentRow[]>([]);
  const [busyPlan, setBusyPlan] = useState<PlanKey | null>(null);
  const accessFn = useServerFn(getMyAccess);
  const createFn = useServerFn(createPaymentRequest);
  const listFn = useServerFn(listMyPaymentRequests);

  const reload = async () => {
    const r = await listFn();
    setRequests(r.requests as PaymentRow[]);
  };

  useEffect(() => {
    accessFn().then(setAccess).catch(() => {});
    reload().catch(() => {});
  }, []);

  const onChoose = async (plan: PlanKey) => {
    setBusyPlan(plan);
    try {
      await createFn({ data: { plan } });
      await reload();
      toast.success("Pesanan dibuat. Lakukan transfer sesuai instruksi di bawah.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyPlan(null);
    }
  };

  const activeRequest = requests.find((r) => r.status === "pending" || r.status === "submitted");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upgrade ke Pro</h1>
        <p className="text-sm text-muted-foreground">
          Aktifkan akun Pro agar scanner & semua fitur bisa digunakan tanpa batas waktu trial.
        </p>
        {access?.tier === "pro" && access.proEndsAt && (
          <p className="mt-2 text-sm">
            <Badge className="bg-emerald-600 hover:bg-emerald-600">PRO Aktif</Badge>{" "}
            <span className="text-muted-foreground">
              hingga {new Date(access.proEndsAt).toLocaleDateString("id-ID")}. Perpanjangan akan
              ditambahkan dari tanggal akhir saat ini.
            </span>
          </p>
        )}
      </div>

      {!activeRequest && (
        <div className="grid gap-4 sm:grid-cols-3">
          {(Object.keys(PLAN_META) as PlanKey[]).map((key) => {
            const m = PLAN_META[key];
            const isBusy = busyPlan === key;
            return (
              <Card key={key} className={key === "pro_12m" ? "border-primary" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{m.label}</CardTitle>
                    {key === "pro_12m" && <Badge>Best Value</Badge>}
                  </div>
                  <CardDescription>
                    <span className="text-2xl font-bold text-foreground">{m.price}</span>{" "}
                    <span className="text-xs">/ {m.months} bulan</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <ul className="space-y-1 text-sm">
                    {m.perks.map((p) => (
                      <li key={p} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-emerald-600" /> {p}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    onClick={() => onChoose(key)}
                    disabled={!!busyPlan}
                  >
                    {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Pesan Sekarang
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeRequest && (
        <ActivePaymentCard
          row={activeRequest}
          userId={user?.id ?? ""}
          onChanged={reload}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riwayat Pesanan</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada pesanan.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Tanggal</th>
                    <th className="py-2">Paket</th>
                    <th className="py-2">Total</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-2">{new Date(r.created_at).toLocaleString("id-ID")}</td>
                      <td className="py-2">{PLAN_META[r.plan].label}</td>
                      <td className="py-2">Rp {formatIDR(r.total_amount)}</td>
                      <td className="py-2">
                        <StatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentRow["status"] }) {
  const map: Record<PaymentRow["status"], { label: string; cls: string }> = {
    pending: { label: "Menunggu Transfer", cls: "bg-amber-600 hover:bg-amber-600" },
    submitted: { label: "Menunggu Verifikasi", cls: "bg-blue-600 hover:bg-blue-600" },
    approved: { label: "Disetujui", cls: "bg-emerald-600 hover:bg-emerald-600" },
    rejected: { label: "Ditolak", cls: "bg-rose-600 hover:bg-rose-600" },
    cancelled: { label: "Dibatalkan", cls: "bg-muted text-muted-foreground hover:bg-muted" },
  };
  const m = map[status];
  return <Badge className={m.cls}>{m.label}</Badge>;
}

function ActivePaymentCard({
  row,
  userId,
  onChanged,
}: {
  row: PaymentRow;
  userId: string;
  onChanged: () => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const submitFn = useServerFn(markPaymentSubmitted);
  const cancelFn = useServerFn(cancelPaymentRequest);

  const onUpload = async (file: File) => {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5 MB");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp)$/.test(file.type) && file.type !== "application/pdf") {
      toast.error("Format file harus JPG, PNG, WEBP, atau PDF");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${userId}/${row.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      await submitFn({ data: { id: row.id, proof_url: path } });
      toast.success("Bukti transfer terkirim. Menunggu verifikasi admin.");
      await onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onCancel = async () => {
    if (!confirm("Batalkan pesanan ini?")) return;
    try {
      await cancelFn({ data: { id: row.id } });
      toast.success("Pesanan dibatalkan");
      await onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card className="border-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Instruksi Pembayaran — {PLAN_META[row.plan].label}
          </CardTitle>
          <StatusBadge status={row.status} />
        </div>
        <CardDescription>
          Transfer sesuai jumlah <span className="font-semibold">tepat</span> di bawah agar
          pembayaran kami verifikasi otomatis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
          <Row label="Bank">
            <span className="font-semibold">{BANK.name}</span>
          </Row>
          <Row label="No. Rekening">
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold">{BANK.number}</span>
              <button
                onClick={() => copy(BANK.number, "Nomor rekening")}
                className="rounded p-1 hover:bg-muted"
                aria-label="Salin nomor rekening"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </Row>
          <Row label="Atas Nama">
            <span className="font-semibold">{BANK.holder}</span>
          </Row>
          <Row label="Jumlah Transfer">
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold text-primary">
                Rp {formatIDR(row.total_amount)}
              </span>
              <button
                onClick={() => copy(String(row.total_amount), "Jumlah transfer")}
                className="rounded p-1 hover:bg-muted"
                aria-label="Salin jumlah"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </Row>
          <p className="text-xs text-muted-foreground">
            Termasuk kode unik <span className="font-semibold">{row.unique_code}</span> agar
            pembayaran Anda mudah diidentifikasi. Jangan dibulatkan.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Upload Bukti Transfer</label>
          <Input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            disabled={uploading || row.status === "submitted"}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onUpload(f);
            }}
          />
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WEBP, atau PDF. Maks 5 MB.
          </p>
          {row.proof_url && (
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <Check className="h-3 w-3" /> Bukti terkirim. Verifikasi 1×24 jam kerja.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {row.proof_url ? "Upload Ulang" : "Pilih File"}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={uploading}>
            <X className="mr-2 h-4 w-4" /> Batalkan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

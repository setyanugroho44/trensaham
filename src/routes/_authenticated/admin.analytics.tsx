import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Link2, ArrowRight, Globe } from "lucide-react";
import { adminGetWebAnalytics } from "@/lib/web-analytics.functions";
import { getMyAccess } from "@/lib/subscription.functions";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  component: AnalyticsPage,
});

type Analytics = Awaited<ReturnType<typeof adminGetWebAnalytics>>;

const RANGES = [
  { days: 7, label: "7 hari" },
  { days: 30, label: "30 hari" },
  { days: 90, label: "90 hari" },
];

function AnalyticsPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const access = await getMyAccess();
        if (!access.isAdmin && !access.isSuperAdmin) {
          toast.error("Akses ditolak");
          navigate({ to: "/dashboard" });
          return;
        }
        setAllowed(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal memeriksa akses");
        navigate({ to: "/dashboard" });
      } finally {
        setChecking(false);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true);
    adminGetWebAnalytics({ data: { days } })
      .then((res) => {
        if (active) setData(res);
      })
      .catch((e) => {
        if (active) toast.error(e instanceof Error ? e.message : "Gagal memuat analitik");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [allowed, days]);

  if (checking) {
    return <div className="text-sm text-muted-foreground">Memeriksa akses…</div>;
  }
  if (!allowed) return null;

  const bySource = data?.bySource ?? { search: 0, referral: 0, direct: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analitik Trafik Web</h1>
          <p className="text-sm text-muted-foreground">
            Kata kunci dari mesin pencari dan situs perujuk pengunjung.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border p-1">
          {RANGES.map((r) => (
            <Button
              key={r.days}
              size="sm"
              variant={days === r.days ? "default" : "ghost"}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Kunjungan" value={data?.total ?? 0} icon={<Globe className="h-4 w-4" />} />
        <StatCard label="Dari Pencarian" value={bySource.search ?? 0} icon={<Search className="h-4 w-4" />} />
        <StatCard label="Dari Situs Lain" value={bySource.referral ?? 0} icon={<Link2 className="h-4 w-4" />} />
        <StatCard label="Langsung/Kampanye" value={bySource.direct ?? 0} icon={<ArrowRight className="h-4 w-4" />} />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Memuat data…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RankCard
              title="Kata Kunci Pencarian"
              icon={<Search className="h-4 w-4" />}
              rows={data?.keywords ?? []}
              emptyText="Belum ada kata kunci terekam. Mesin pencari modern sering menyembunyikan kata kunci; data muncul dari klik iklan (utm_term) atau mesin yang meneruskan kata kunci."
            />
            <RankCard
              title="Situs Perujuk (Referrer)"
              icon={<Link2 className="h-4 w-4" />}
              rows={data?.referrers ?? []}
              emptyText="Belum ada kunjungan dari situs lain."
            />
            <RankCard
              title="Mesin Pencari"
              icon={<Globe className="h-4 w-4" />}
              rows={data?.engines ?? []}
              emptyText="Belum ada kunjungan dari mesin pencari."
            />
            <RankCard
              title="Kampanye (UTM)"
              icon={<ArrowRight className="h-4 w-4" />}
              rows={data?.campaigns ?? []}
              emptyText="Belum ada kunjungan dari kampanye."
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kunjungan Terbaru</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Sumber</TableHead>
                      <TableHead>Kata Kunci / Perujuk</TableHead>
                      <TableHead>Halaman</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.recent ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Belum ada kunjungan
                        </TableCell>
                      </TableRow>
                    ) : (
                      (data?.recent ?? []).map((v, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(v.created_at).toLocaleString("id-ID")}
                          </TableCell>
                          <TableCell>
                            <SourceBadge type={v.source_type} />
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">
                            {v.source_type === "search"
                              ? v.search_keyword
                                ? `"${v.search_keyword}"${v.search_engine ? ` — ${v.search_engine}` : ""}`
                                : v.search_engine ?? "—"
                              : v.referrer_domain ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                            {v.landing_path ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-3xl font-bold">{value.toLocaleString("id-ID")}</CardContent>
    </Card>
  );
}

function RankCard({
  title,
  icon,
  rows,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { label: string; count: number }[];
  emptyText: string;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0) || 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.label} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate" title={r.label}>{r.label}</span>
                  <span className="font-medium tabular-nums">{r.count}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${(r.count / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SourceBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    search: { label: "Pencarian", cls: "bg-primary/10 text-primary" },
    referral: { label: "Situs Lain", cls: "bg-secondary text-secondary-foreground" },
    direct: { label: "Langsung", cls: "bg-muted text-muted-foreground" },
  };
  const s = map[type] ?? map.direct;
  return <span className={`text-xs px-2 py-1 rounded ${s.cls}`}>{s.label}</span>;
}

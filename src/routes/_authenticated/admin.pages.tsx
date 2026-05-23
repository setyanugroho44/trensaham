import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { adminListPages, adminUpsertPage, adminDeletePage } from "@/lib/cms.functions";
import { Pencil, Trash2, Plus, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/pages")({
  component: AdminPagesPage,
});

type Row = { id: string; slug: string; title: string; visibility: string; updated_at: string };

function AdminPagesPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [pages, setPages] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { isAdmin } = await isCurrentUserAdmin();
        if (!isAdmin) {
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

  const load = async () => {
    setLoading(true);
    try {
      const { pages } = await adminListPages();
      setPages(pages as Row[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat halaman");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (checking) return <div className="text-sm text-muted-foreground">Memeriksa akses…</div>;
  if (!allowed) return null;

  const onCreate = async () => {
    const slug = newSlug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error("Slug hanya boleh huruf kecil, angka, dan tanda hubung");
      return;
    }
    if (!newTitle.trim()) {
      toast.error("Judul wajib diisi");
      return;
    }
    setSaving(true);
    try {
      await adminUpsertPage({
        data: {
          slug,
          title: newTitle.trim(),
          visibility: "public",
          sections: [{ id: "main", heading: "", content: "<p>Mulai menulis…</p>" }],
        },
      });
      toast.success("Halaman dibuat");
      setCreating(false);
      setNewSlug("");
      setNewTitle("");
      await load();
      navigate({ to: "/admin/pages/$slug", params: { slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat halaman");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    try {
      await adminDeletePage({ data: { slug: deleting.slug } });
      toast.success("Halaman dihapus");
      setDeleting(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kelola Halaman</h1>
          <p className="text-sm text-muted-foreground">Buat dan edit halaman dengan visual editor.</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Halaman Baru</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar Halaman</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judul</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Visibilitas</TableHead>
                  <TableHead>Diperbarui</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Memuat…</TableCell></TableRow>
                ) : pages.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Belum ada halaman</TableCell></TableRow>
                ) : (
                  pages.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.title}</TableCell>
                      <TableCell className="font-mono text-xs">{p.slug}</TableCell>
                      <TableCell>
                        <span className={p.visibility === "public" ? "text-xs px-2 py-1 rounded bg-primary/10 text-primary" : "text-xs px-2 py-1 rounded bg-muted text-muted-foreground"}>
                          {p.visibility}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(p.updated_at).toLocaleString("id-ID")}
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button asChild size="sm" variant="ghost" title="Lihat">
                          <Link to={p.slug === "landing" ? "/" : "/p/$slug"} params={p.slug === "landing" ? undefined : { slug: p.slug }} target="_blank">
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/admin/pages/$slug" params={{ slug: p.slug }}>
                            <Pencil className="mr-1 h-3 w-3" />Edit
                          </Link>
                        </Button>
                        {p.slug !== "landing" && (
                          <Button size="sm" variant="destructive" onClick={() => setDeleting(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Halaman Baru</DialogTitle>
            <DialogDescription>Tentukan slug URL dan judul halaman.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Slug (URL)</Label>
              <Input
                placeholder="contoh: tentang-kami"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">URL akan menjadi <code>/p/{newSlug || "slug"}</code></p>
            </div>
            <div className="space-y-1">
              <Label>Judul</Label>
              <Input
                placeholder="Tentang Kami"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>Batal</Button>
            <Button onClick={onCreate} disabled={saving}>{saving ? "Membuat…" : "Buat & Edit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus halaman?</AlertDialogTitle>
            <AlertDialogDescription>
              Halaman "{deleting?.title}" akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

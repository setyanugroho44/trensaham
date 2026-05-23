import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  adminDeleteUser,
  adminListUsers,
  adminUpdateProfile,
  isCurrentUserAdmin,
  isCurrentUserSuperAdmin,
  promoteAdminByEmail,
} from "@/lib/admin.functions";
import { adminExtendSubscription } from "@/lib/subscription.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type Row = {
  id: string;
  email: string | undefined;
  created_at: string;
  last_sign_in_at: string | null;
  full_name: string | null;
  address: string | null;
  phone: string | null;
  roles: string[];
  tier: "free" | "pro";
  trial_ends_at: string | null;
  pro_ends_at: string | null;
};

function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [subRow, setSubRow] = useState<Row | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoting, setPromoting] = useState(false);

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
        try {
          const { isSuperAdmin } = await isCurrentUserSuperAdmin();
          setIsSuper(isSuperAdmin);
        } catch { /* ignore */ }
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
      const { users } = await adminListUsers();
      setUsers(users);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memuat user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) load();
  }, [allowed]);

  if (checking) {
    return <div className="text-sm text-muted-foreground">Memeriksa akses…</div>;
  }
  if (!allowed) return null;

  const filtered = users.filter((u) => {
    const s = q.toLowerCase().trim();
    if (!s) return true;
    return (
      (u.email ?? "").toLowerCase().includes(s) ||
      (u.full_name ?? "").toLowerCase().includes(s) ||
      (u.phone ?? "").toLowerCase().includes(s)
    );
  });

  const onSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await adminUpdateProfile({
        data: {
          user_id: editing.id,
          full_name: editing.full_name,
          address: editing.address,
          phone: editing.phone,
        },
      });
      toast.success("Profil diperbarui");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleting) return;
    try {
      await adminDeleteUser({ data: { user_id: deleting.id } });
      toast.success("User dihapus");
      setDeleting(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  };

  const onSubAction = async (action: "extend_6" | "extend_12" | "set_trial_14" | "deactivate") => {
    if (!subRow) return;
    setSubBusy(true);
    try {
      await adminExtendSubscription({ data: { user_id: subRow.id, action } });
      toast.success("Langganan diperbarui");
      setSubRow(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memperbarui langganan");
    } finally {
      setSubBusy(false);
    }
  };

  const subStatus = (u: Row): { label: string; tone: "default" | "secondary" | "destructive" | "outline" } => {
    const now = Date.now();
    if (u.tier === "pro" && u.pro_ends_at && new Date(u.pro_ends_at).getTime() > now) {
      return { label: `Pro s/d ${new Date(u.pro_ends_at).toLocaleDateString("id-ID")}`, tone: "default" };
    }
    if (u.trial_ends_at && new Date(u.trial_ends_at).getTime() > now) {
      return { label: `Trial s/d ${new Date(u.trial_ends_at).toLocaleDateString("id-ID")}`, tone: "secondary" };
    }
    return { label: "Expired", tone: "destructive" };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administrator</h1>
        <p className="text-sm text-muted-foreground">Kelola user terdaftar.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total User</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{users.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Admin</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">
            {users.filter((u) => u.roles.includes("admin")).length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pernah Login</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">
            {users.filter((u) => u.last_sign_in_at).length}
          </CardContent>
        </Card>
      </div>

      {isSuper && (
        <Card>
          <CardHeader>
            <CardTitle>Angkat Admin Baru</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col sm:flex-row gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!promoteEmail.trim()) return;
                setPromoting(true);
                try {
                  await promoteAdminByEmail({ data: { email: promoteEmail.trim() } });
                  toast.success(`${promoteEmail} kini admin`);
                  setPromoteEmail("");
                  await load();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Gagal mengangkat admin");
                } finally {
                  setPromoting(false);
                }
              }}
            >
              <Input
                type="email"
                placeholder="email@contoh.com"
                value={promoteEmail}
                onChange={(e) => setPromoteEmail(e.target.value)}
                required
              />
              <Button type="submit" disabled={promoting}>
                {promoting ? "Memproses…" : "Jadikan Admin"}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              Hanya super admin yang dapat mengangkat admin baru.
            </p>
          </CardContent>
        </Card>
      )}


      <Card>
        <CardHeader>
          <CardTitle>Daftar User</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Cari email, nama, atau no HP…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>No HP</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Langganan</TableHead>
                  <TableHead>Daftar</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Memuat…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Tidak ada user</TableCell></TableRow>
                ) : (
                  filtered.map((u) => {
                    const s = subStatus(u);
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>{u.full_name ?? "—"}</TableCell>
                        <TableCell>{u.phone ?? "—"}</TableCell>
                        <TableCell>{u.roles.join(", ") || "user"}</TableCell>
                        <TableCell>
                          <span className={
                            s.tone === "destructive"
                              ? "text-xs px-2 py-1 rounded bg-destructive/10 text-destructive"
                              : s.tone === "default"
                                ? "text-xs px-2 py-1 rounded bg-primary/10 text-primary"
                                : "text-xs px-2 py-1 rounded bg-muted text-muted-foreground"
                          }>{s.label}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("id-ID")}
                        </TableCell>
                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                          <Button size="sm" variant="outline" onClick={() => setSubRow(u)}>Langganan</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditing({ ...u })}>Edit</Button>
                          <Button size="sm" variant="destructive" onClick={() => setDeleting(u)}>Hapus</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profil</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nama</Label>
                <Input
                  value={editing.full_name ?? ""}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>No HP</Label>
                <Input
                  value={editing.phone ?? ""}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Alamat</Label>
                <Textarea
                  rows={3}
                  value={editing.address ?? ""}
                  onChange={(e) => setEditing({ ...editing, address: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Batal</Button>
            <Button onClick={onSave} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!subRow} onOpenChange={(o) => !o && setSubRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kelola Langganan</DialogTitle>
            <DialogDescription>{subRow?.email}</DialogDescription>
          </DialogHeader>
          {subRow && (
            <div className="space-y-3 text-sm">
              <div className="rounded border p-3 space-y-1">
                <div>Tier: <span className="font-medium">{subRow.tier}</span></div>
                <div>Trial berakhir: <span className="font-medium">{subRow.trial_ends_at ? new Date(subRow.trial_ends_at).toLocaleString("id-ID") : "—"}</span></div>
                <div>Pro berakhir: <span className="font-medium">{subRow.pro_ends_at ? new Date(subRow.pro_ends_at).toLocaleString("id-ID") : "—"}</span></div>
              </div>
              <p className="text-xs text-muted-foreground">
                Perpanjangan ditambahkan dari tanggal berakhir saat ini (jika masih aktif) atau dari hari ini.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button disabled={subBusy} onClick={() => onSubAction("extend_6")}>+ 6 Bulan Pro</Button>
                <Button disabled={subBusy} onClick={() => onSubAction("extend_12")}>+ 12 Bulan Pro</Button>
                <Button disabled={subBusy} variant="outline" onClick={() => onSubAction("set_trial_14")}>Reset Trial 14 hari</Button>
                <Button disabled={subBusy} variant="destructive" onClick={() => onSubAction("deactivate")}>Nonaktifkan</Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSubRow(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus user?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.email} akan dihapus permanen beserta seluruh datanya.
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

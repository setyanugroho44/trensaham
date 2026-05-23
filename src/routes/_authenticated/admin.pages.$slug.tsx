import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isCurrentUserAdmin } from "@/lib/admin.functions";
import { adminGetPage, adminUpsertPage, type CmsSection } from "@/lib/cms.functions";
import { RichEditor } from "@/components/rich-editor";
import { ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/pages/$slug")({
  component: EditPage,
});

function EditPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [sections, setSections] = useState<CmsSection[]>([]);

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
      } catch {
        navigate({ to: "/dashboard" });
      } finally {
        setChecking(false);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      setLoading(true);
      try {
        const { page } = await adminGetPage({ data: { slug } });
        if (!page) {
          toast.error("Halaman tidak ditemukan");
          navigate({ to: "/admin/pages" });
          return;
        }
        setTitle(page.title);
        setVisibility(page.visibility);
        setSections(page.sections.length ? page.sections : [{ id: "main", heading: "", content: "" }]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal memuat");
      } finally {
        setLoading(false);
      }
    })();
  }, [allowed, slug, navigate]);

  const onSave = async () => {
    setSaving(true);
    try {
      await adminUpsertPage({
        data: { slug, title, visibility, sections },
      });
      toast.success("Tersimpan");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (idx: number, patch: Partial<CmsSection>) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    const next = sections.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setSections(next);
  };

  const remove = (idx: number) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const add = () => {
    const id = `s-${Date.now().toString(36)}`;
    setSections((prev) => [...prev, { id, heading: "", content: "" }]);
  };

  if (checking || !allowed) return <div className="text-sm text-muted-foreground">Memeriksa akses…</div>;
  if (loading) return <div className="text-sm text-muted-foreground">Memuat…</div>;

  const publicHref = slug === "landing" ? "/" : `/p/${slug}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/pages"><ArrowLeft className="mr-1 h-4 w-4" />Kembali</Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">Edit: {slug}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={publicHref} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Lihat</a>
          </Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Pengaturan</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Judul</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Visibilitas</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as "public" | "private")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Publik (dapat dilihat semua orang)</SelectItem>
                <SelectItem value="private">Privat (hanya user login)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sections.map((s, i) => (
          <Card key={s.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm text-muted-foreground">Section {i + 1}</CardTitle>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === sections.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(i)} disabled={sections.length === 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Heading</Label>
                <Input
                  placeholder="Sub-judul (opsional)"
                  value={s.heading}
                  onChange={(e) => updateSection(i, { heading: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Konten</Label>
                <RichEditor
                  value={s.content}
                  onChange={(html) => updateSection(i, { content: html })}
                  placeholder="Tulis konten section di sini…"
                />
              </div>
            </CardContent>
          </Card>
        ))}

        <Button variant="outline" onClick={add} className="w-full">
          <Plus className="mr-2 h-4 w-4" />Tambah Section
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
      </div>
    </div>
  );
}

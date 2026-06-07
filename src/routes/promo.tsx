import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { toast } from 'sonner'
import { adSignup } from '@/lib/ad-signup.functions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, LineChart, Mail, ShieldCheck, Zap } from 'lucide-react'

export const Route = createFileRoute('/promo')({
  component: PromoPage,
  head: () => ({
    meta: [
      { title: 'Daftar Gratis — Scanner Pola Harmonic Saham IDX' },
      {
        name: 'description',
        content:
          'Dapatkan akses scanner pola harmonic saham Indonesia. Daftar cukup dengan nama dan email, password dikirim langsung ke inbox Anda.',
      },
      { property: 'og:title', content: 'Daftar Gratis — Scanner Pola Harmonic Saham IDX' },
      {
        property: 'og:description',
        content:
          'Daftar cukup dengan nama dan email. Password login dikirim langsung ke inbox Anda.',
      },
    ],
  }),
})

const formSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(100),
  email: z.string().trim().email('Email tidak valid').max(320),
})

function PromoPage() {
  const submit = useServerFn(adSignup)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = formSchema.safeParse({ name, email })
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Periksa kembali isian Anda')
      return
    }
    setSubmitting(true)
    try {
      const res = await submit({ data: parsed.data })
      if (res.ok) {
        setSentEmail(parsed.data.email)
        setDone(true)
      } else {
        toast.error(res.message ?? 'Terjadi kesalahan. Coba lagi.')
      }
    } catch {
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-2 md:items-center md:py-20">
        {/* Left: pitch */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <LineChart className="h-3.5 w-3.5 text-primary" />
            Analisa Saham Indo
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Temukan Pola Harmonic Saham IDX Secara Otomatis
          </h1>
          <p className="text-base text-muted-foreground">
            Scanner kami memindai pola Gartley, Bat, Butterfly, Crab, dan AB=CD pada
            ratusan saham Indonesia. Daftar cukup dengan nama dan email — password
            login langsung kami kirim ke inbox Anda.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2">
              <Zap className="mt-0.5 h-4 w-4 text-primary" />
              Deteksi pola harmonic completed &amp; developing
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              Zona PRZ &amp; level invalidation yang jelas
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
              Watchlist saham &amp; bonus pemindaian IHSG
            </li>
          </ul>
        </div>

        {/* Right: form / success */}
        <Card className="shadow-lg">
          {done ? (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Cek Email Anda</CardTitle>
                <CardDescription>
                  Kami telah mengirim password login ke{' '}
                  <span className="font-medium text-foreground">{sentEmail}</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Buka email tersebut untuk melihat password Anda, lalu gunakan tombol
                  di bawah untuk masuk. Jika tidak ada di inbox, periksa folder spam.
                </p>
                <Button asChild className="w-full">
                  <Link to="/login">Buka Halaman Login</Link>
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Daftar Gratis</CardTitle>
                <CardDescription>
                  Masukkan nama dan email. Password akan dikirim ke email Anda.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={100}
                      placeholder="Nama lengkap"
                      autoComplete="name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={320}
                      placeholder="email@contoh.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'Memproses…' : 'Kirim'}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Sudah punya akun?{' '}
                    <Link to="/login" className="text-primary underline">
                      Masuk
                    </Link>
                  </p>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

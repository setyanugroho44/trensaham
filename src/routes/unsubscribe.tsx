import { createFileRoute, useSearch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/unsubscribe')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  component: UnsubscribePage,
  head: () => ({ meta: [{ title: 'Berhenti Berlangganan Email' }] }),
})

type State = 'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error'

function UnsubscribePage() {
  const { token } = useSearch({ from: '/unsubscribe' })
  const [state, setState] = useState<State>('loading')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) {
      setState('invalid')
      return
    }
    let alive = true
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return
        if (d.valid) setState('valid')
        else if (d.reason === 'already_unsubscribed') setState('already')
        else setState('invalid')
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [token])

  const confirm = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const d = await res.json()
      if (d.success) setState('success')
      else if (d.reason === 'already_unsubscribed') setState('already')
      else setState('error')
    } catch {
      setState('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Berhenti Berlangganan</CardTitle>
          <CardDescription>
            {state === 'loading' && 'Memeriksa tautan…'}
            {state === 'valid' && 'Konfirmasi untuk berhenti menerima email dari kami.'}
            {state === 'already' && 'Anda sudah berhenti berlangganan.'}
            {state === 'invalid' && 'Tautan tidak valid atau sudah kedaluwarsa.'}
            {state === 'success' && 'Anda berhasil berhenti berlangganan.'}
            {state === 'error' && 'Terjadi kesalahan. Silakan coba lagi.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state === 'valid' && (
            <Button onClick={confirm} disabled={submitting} className="w-full">
              {submitting ? 'Memproses…' : 'Konfirmasi Berhenti Berlangganan'}
            </Button>
          )}
          {state === 'success' && (
            <p className="text-sm text-muted-foreground">
              Anda tidak akan menerima email dari kami lagi.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

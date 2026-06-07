import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const inputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(320),
})

const LOGIN_URL = 'https://www.analisasahamindo.com/login'

// Generate a readable password (no ambiguous characters)
function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length]
  return out
}

/**
 * Public, unauthenticated signup used by ad landing pages. Creates a confirmed
 * account with a generated password, stores the name, and emails the credentials
 * plus a login link to the user.
 */
export const adSignup = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const { name, email } = data
    const normalizedEmail = email.toLowerCase()

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { dispatchTransactionalEmail } = await import('@/lib/email/dispatch.server')

    const password = generatePassword()

    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      })

    if (createError || !created?.user) {
      const msg = createError?.message ?? ''
      if (/already|registered|exists/i.test(msg)) {
        return {
          ok: false as const,
          reason: 'already_registered' as const,
          message:
            'Email ini sudah terdaftar. Silakan login atau gunakan fitur lupa password.',
        }
      }
      console.error('[ad-signup] createUser failed', { error: msg })
      return {
        ok: false as const,
        reason: 'create_failed' as const,
        message: 'Gagal membuat akun. Silakan coba lagi.',
      }
    }

    // Ensure the profile stores the name (trigger may have created the row already).
    await supabaseAdmin.from('profiles').upsert(
      { user_id: created.user.id, full_name: name },
      { onConflict: 'user_id' },
    )

    const sent = await dispatchTransactionalEmail({
      templateName: 'welcome-credentials',
      recipientEmail: normalizedEmail,
      templateData: { name, email: normalizedEmail, password, loginUrl: LOGIN_URL },
    })

    if (!sent.ok) {
      console.error('[ad-signup] email dispatch failed', { reason: sent.reason })
      return {
        ok: false as const,
        reason: 'email_failed' as const,
        message:
          'Akun dibuat tetapi email gagal dikirim. Silakan hubungi support.',
      }
    }

    return { ok: true as const }
  })

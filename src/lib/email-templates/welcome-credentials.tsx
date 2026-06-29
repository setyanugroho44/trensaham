import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  email?: string
  password?: string
  loginUrl?: string
}

const Email = ({ name, email, password, loginUrl }: Props) => {
  const greeting = name ? `Halo ${name},` : 'Halo,'
  const url = loginUrl || 'https://www.analisasahamindo.com/login'
  return (
    <Html lang="id" dir="ltr">
      <Head />
      <Preview>Akun Analisa Saham Indo Anda sudah aktif — ini detail login Anda</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Selamat datang di Analisa Saham Indo</Heading>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>
            Akun Anda sudah berhasil dibuat. Gunakan detail di bawah ini untuk masuk
            ke aplikasi dan mulai memindai pola harmonic saham IDX.
          </Text>

          <Section style={credBox}>
            <Text style={credLabel}>Email</Text>
            <Text style={credValue}>{email || '-'}</Text>
            <Text style={credLabel}>Password</Text>
            <Text style={credValue}>{password || '-'}</Text>
          </Section>

          <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
            <Button style={button} href={url}>
              Masuk ke Akun Saya
            </Button>
          </Section>

          <Text style={textMuted}>
            Demi keamanan, kami sarankan Anda segera mengganti password setelah login
            melalui menu Profil.
          </Text>

          <Hr style={hr} />
          <Text style={footer}>
            Jika tombol di atas tidak berfungsi, salin tautan berikut ke browser Anda:
            <br />
            {url}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: 'Akun Anda aktif — detail login Analisa Saham Indo',
  displayName: 'Welcome — Login Credentials',
  previewData: {
    name: 'Budi',
    email: 'budi@example.com',
    password: 'Xy7kPq2mR9',
    loginUrl: 'https://www.analisasahamindo.com/login',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
}

const container = {
  margin: '0 auto',
  padding: '24px',
  maxWidth: '520px',
}

const h1 = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: '700',
  margin: '0 0 16px',
}

const text = {
  color: '#1e293b',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 12px',
}

const textMuted = {
  color: '#64748b',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '8px 0 0',
}

const credBox = {
  backgroundColor: '#f1f5f9',
  borderRadius: '10px',
  padding: '16px 20px',
  margin: '20px 0',
}

const credLabel = {
  color: '#64748b',
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '8px 0 2px',
}

const credValue = {
  color: '#0f172a',
  fontSize: '17px',
  fontWeight: '700',
  margin: '0',
}

const button = {
  backgroundColor: '#3B82F6',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'underline',
  padding: '12px 28px',
  display: 'inline-block',
}

const hr = {
  borderColor: '#e2e8f0',
  margin: '24px 0 16px',
}

const footer = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0',
  wordBreak: 'break-all' as const,
}

export default Email

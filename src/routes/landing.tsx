import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { toast } from 'sonner'
import { adSignup } from '@/lib/ad-signup.functions'

export const Route = createFileRoute('/landing')({
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

/* ─── Animated Candlestick Chart SVG ─── */
function HarmonicChartIllustration() {
  return (
    <svg
      viewBox="0 0 520 260"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0f1629" />
          <stop offset="100%" stopColor="#070d1a" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
          <stop offset="40%" stopColor="#3b82f6" stopOpacity="1" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="1" />
        </linearGradient>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="patternGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="520" height="260" fill="url(#chartBg)" rx="12" />

      {/* Grid lines */}
      {[40, 80, 120, 160, 200].map((y) => (
        <line key={y} x1="40" y1={y} x2="500" y2={y} stroke="#1e2d4a" strokeWidth="0.5" />
      ))}
      {[80, 160, 240, 320, 400, 480].map((x) => (
        <line key={x} x1={x} y1="20" x2={x} y2="220" stroke="#1e2d4a" strokeWidth="0.5" />
      ))}

      {/* Price labels */}
      {[
        { y: 42, label: '1850' },
        { y: 82, label: '1720' },
        { y: 122, label: '1590' },
        { y: 162, label: '1460' },
        { y: 202, label: '1330' },
      ].map(({ y, label }) => (
        <text key={label} x="36" y={y} textAnchor="end" fontSize="9" fill="#4a5568">
          {label}
        </text>
      ))}

      {/* Candlesticks */}
      {[
        { x: 65, o: 170, c: 148, h: 140, l: 178, bull: true },
        { x: 90, o: 148, c: 155, h: 143, l: 160, bull: false },
        { x: 115, o: 155, c: 140, h: 134, l: 162, bull: true },
        { x: 140, o: 140, c: 130, h: 124, l: 148, bull: true },
        { x: 165, o: 130, c: 138, h: 135, l: 145, bull: false },
        { x: 190, o: 138, c: 125, h: 120, l: 142, bull: true },
        { x: 215, o: 125, c: 115, h: 108, l: 130, bull: true },
        { x: 240, o: 115, c: 122, h: 110, l: 128, bull: false },
        { x: 265, o: 122, c: 108, h: 102, l: 126, bull: true },
        { x: 290, o: 108, c: 95, h: 88, l: 114, bull: true },
        { x: 315, o: 95, c: 105, h: 90, l: 110, bull: false },
        { x: 340, o: 105, c: 88, h: 82, l: 108, bull: true },
        { x: 365, o: 88, c: 75, h: 68, l: 93, bull: true },
        { x: 390, o: 75, c: 82, h: 70, l: 87, bull: false },
        { x: 415, o: 82, c: 70, h: 64, l: 86, bull: true },
        { x: 440, o: 70, c: 62, h: 55, l: 74, bull: true },
        { x: 465, o: 62, c: 72, h: 57, l: 76, bull: false },
      ].map(({ x, o, c, h, l, bull }) => (
        <g key={x}>
          <line x1={x} y1={h} x2={x} y2={l} stroke={bull ? '#10b981' : '#ef4444'} strokeWidth="1" />
          <rect
            x={x - 5}
            y={Math.min(o, c)}
            width="10"
            height={Math.max(Math.abs(o - c), 1)}
            fill={bull ? '#10b981' : '#ef4444'}
            rx="1"
          />
        </g>
      ))}

      {/* Harmonic pattern overlay (Gartley/Bat shape) */}
      <polyline
        points="90,155 165,138 290,95 365,75 465,62"
        fill="none"
        stroke="url(#patternGrad)"
        strokeWidth="1.5"
        strokeDasharray="4 2"
        filter="url(#glow)"
      />

      {/* Pattern connection lines */}
      <line x1="90" y1="155" x2="365" y2="75" stroke="#f59e0b" strokeWidth="0.8" strokeOpacity="0.3" />
      <line x1="165" y1="138" x2="465" y2="62" stroke="#f59e0b" strokeWidth="0.8" strokeOpacity="0.3" />
      <line x1="290" y1="95" x2="365" y2="75" stroke="#8b5cf6" strokeWidth="1" strokeOpacity="0.5" />

      {/* Pattern node dots */}
      {[
        { cx: 90, cy: 155, label: 'X' },
        { cx: 165, cy: 138, label: 'A' },
        { cx: 290, cy: 95, label: 'B' },
        { cx: 365, cy: 75, label: 'C' },
        { cx: 465, cy: 62, label: 'D' },
      ].map(({ cx, cy, label }) => (
        <g key={label} filter="url(#glow)">
          <circle cx={cx} cy={cy} r="5" fill="#0f1629" stroke="#f59e0b" strokeWidth="1.5" />
          <text x={cx} y={cy - 9} textAnchor="middle" fontSize="9" fill="#f59e0b" fontWeight="600">
            {label}
          </text>
        </g>
      ))}

      {/* PRZ Zone box */}
      <rect x="440" y="52" width="55" height="40" rx="3" fill="#8b5cf6" fillOpacity="0.15" stroke="#8b5cf6" strokeWidth="0.8" strokeOpacity="0.6" />
      <text x="467" y="66" textAnchor="middle" fontSize="8" fill="#a78bfa" fontWeight="600">PRZ</text>
      <text x="467" y="77" textAnchor="middle" fontSize="7.5" fill="#7c3aed" fillOpacity="0.8">Buy Zone</text>

      {/* Volume bars */}
      {[
        { x: 65, h: 18, bull: true },
        { x: 90, h: 12, bull: false },
        { x: 115, h: 22, bull: true },
        { x: 140, h: 28, bull: true },
        { x: 165, h: 14, bull: false },
        { x: 190, h: 20, bull: true },
        { x: 215, h: 32, bull: true },
        { x: 240, h: 11, bull: false },
        { x: 265, h: 18, bull: true },
        { x: 290, h: 35, bull: true },
        { x: 315, h: 15, bull: false },
        { x: 340, h: 25, bull: true },
        { x: 365, h: 38, bull: true },
        { x: 390, h: 16, bull: false },
        { x: 415, h: 22, bull: true },
        { x: 440, h: 42, bull: true },
        { x: 465, h: 19, bull: false },
      ].map(({ x, h, bull }) => (
        <rect
          key={x}
          x={x - 5}
          y={252 - h}
          width="10"
          height={h}
          fill={bull ? '#10b981' : '#ef4444'}
          fillOpacity="0.4"
          rx="1"
        />
      ))}

      {/* Badge */}
      <rect x="44" y="24" width="76" height="16" rx="4" fill="#1e3a5f" />
      <text x="82" y="35" textAnchor="middle" fontSize="8" fill="#60a5fa" fontWeight="600">
        GARTLEY PATTERN
      </text>
    </svg>
  )
}

/* ─── Main Component ─── */
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
    <div className="promo-root">
      {/* ── Noise texture + grid bg ── */}
      <div className="promo-bg" aria-hidden="true">
        <div className="promo-bg-grid" />
        <div className="promo-bg-glow promo-bg-glow--blue" />
        <div className="promo-bg-glow promo-bg-glow--purple" />
      </div>

      {/* ── Top nav bar ── */}
      <header className="promo-nav">
        <div className="promo-nav-inner">
          <div className="promo-logo">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M3 17L8 9l4 5 3-4 4 7" stroke="#3b82f6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="19" cy="4" r="2.5" fill="#8b5cf6" />
            </svg>
            <span className="promo-logo-text">HarmonicIDX</span>
          </div>
          <Link to="/login" className="promo-nav-link">Masuk →</Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="promo-main">
        <section className="promo-hero">

          {/* Left column */}
          <div className="promo-pitch">
            <div className="promo-badge">
              <span className="promo-badge-dot" />
              Analisa Saham IDX · Pola Harmonic
            </div>

            <h1 className="promo-headline">
              Temukan Pola<br />
              <span className="promo-headline-accent">Harmonic Saham</span><br />
              Secara Otomatis
            </h1>

            <p className="promo-subline">
              Scan puluhan saham IDX dalam hitungan detik. Deteksi pola, zona pembalikan,
              dan level invalidasi — tanpa perlu analisa manual.
            </p>

            {/* Chart illustration */}
            <div className="promo-chart-wrap">
              <HarmonicChartIllustration />
              <div className="promo-chart-overlay">
                <span className="promo-chart-tag promo-chart-tag--green">
                  <span className="promo-chart-tag-dot promo-chart-tag-dot--green" />
                  +4.2% PRZ Reversal
                </span>
                <span className="promo-chart-tag promo-chart-tag--purple">
                  Zona Entry Aktif
                </span>
              </div>
            </div>

            {/* Feature list */}
            <ul className="promo-features">
              {[
                { icon: '⚡', text: 'Deteksi pola Harmonic jangka pendek, menengah & panjang' },
                { icon: '🛡️', text: 'Zona PRZ & level invalidation yang jelas' },
                { icon: '📋', text: 'Watchlist saham & bonus pemindaian IHSG' },
              ].map(({ icon, text }) => (
                <li key={text} className="promo-feature-item">
                  <span className="promo-feature-icon">{icon}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>

            {/* Social proof */}
            <div className="promo-social-proof">
              <div className="promo-avatars">
                {['IW', 'BR', 'AS', 'DK'].map((init) => (
                  <div key={init} className="promo-avatar">{init}</div>
                ))}
              </div>
              <p className="promo-social-text">
                <strong>1.200+ trader IDX</strong> sudah bergabung
              </p>
            </div>
          </div>

          {/* Right column — form */}
          <div className="promo-form-col">
            <div className="promo-card">
              {done ? (
                <div className="promo-success">
                  <div className="promo-success-icon">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                      <circle cx="16" cy="16" r="15" stroke="#3b82f6" strokeWidth="1.5" />
                      <path d="M10 16l4 4 8-8" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h2 className="promo-success-title">Cek Email Anda!</h2>
                  <p className="promo-success-desc">
                    Password login telah dikirim ke{' '}
                    <strong className="promo-success-email">{sentEmail}</strong>.
                    Periksa inbox atau folder spam.
                  </p>
                  <Link to="/login" className="promo-btn promo-btn--full">
                    Buka Halaman Login →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="promo-card-header">
                    <div className="promo-card-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M3 5h14v10a1 1 0 01-1 1H4a1 1 0 01-1-1V5z" stroke="#3b82f6" strokeWidth="1.4" />
                        <path d="M3 5l7 7 7-7" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="promo-card-title">Daftar Gratis</h2>
                      <p className="promo-card-subtitle">Password dikirim ke email Anda</p>
                    </div>
                  </div>

                  <form onSubmit={onSubmit} className="promo-form">
                    <div className="promo-field">
                      <label htmlFor="name" className="promo-label">Nama Lengkap</label>
                      <input
                        id="name"
                        className="promo-input"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={100}
                        placeholder="Contoh: Budi Santoso"
                        autoComplete="name"
                        required
                      />
                    </div>
                    <div className="promo-field">
                      <label htmlFor="email" className="promo-label">Alamat Email</label>
                      <input
                        id="email"
                        type="email"
                        className="promo-input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        maxLength={320}
                        placeholder="email@contoh.com"
                        autoComplete="email"
                        required
                      />
                    </div>

                    <button type="submit" className="promo-btn promo-btn--full" disabled={submitting}>
                      {submitting ? (
                        <span className="promo-spinner" aria-hidden="true" />
                      ) : null}
                      {submitting ? 'Memproses…' : 'Mulai Gratis Sekarang →'}
                    </button>

                    <p className="promo-form-footer">
                      Sudah punya akun?{' '}
                      <Link to="/login" className="promo-form-link">Masuk di sini</Link>
                    </p>
                  </form>

                  {/* Trust badges */}
                  <div className="promo-trust">
                    {[
                      { icon: '🔒', text: 'Data aman & terenkripsi' },
                      { icon: '✉️', text: 'Tanpa spam' },
                      { icon: '🚀', text: 'Akses instan' },
                    ].map(({ icon, text }) => (
                      <div key={text} className="promo-trust-item">
                        <span>{icon}</span>
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Stats row below card */}
            <div className="promo-stats">
              {[
                { value: '50+', label: 'Saham IDX' },
                { value: '6', label: 'Pola Harmonic' },
                { value: '99%', label: 'Uptime' },
              ].map(({ value, label }) => (
                <div key={label} className="promo-stat">
                  <span className="promo-stat-value">{value}</span>
                  <span className="promo-stat-label">{label}</span>
                </div>
              ))}
            </div>
          </div>

        </section>
      </main>

      <style>{`
        /* ── Reset & Base ── */
        .promo-root {
          position: relative;
          min-height: 100vh;
          background: #060c18;
          color: #e2e8f0;
          font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
          overflow-x: hidden;
        }

        /* ── Background ── */
        .promo-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .promo-bg-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .promo-bg-glow {
          position: absolute; border-radius: 50%;
          filter: blur(100px); opacity: 0.12;
        }
        .promo-bg-glow--blue {
          width: 600px; height: 600px; top: -150px; left: -100px;
          background: #3b82f6;
        }
        .promo-bg-glow--purple {
          width: 500px; height: 500px; bottom: 0; right: -100px;
          background: #8b5cf6;
        }

        /* ── Nav ── */
        .promo-nav {
          position: relative; z-index: 10;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(12px);
        }
        .promo-nav-inner {
          max-width: 1100px; margin: 0 auto;
          padding: 14px 24px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .promo-logo { display: flex; align-items: center; gap: 8px; }
        .promo-logo-text {
          font-size: 15px; font-weight: 700; letter-spacing: -0.02em;
          color: #f1f5f9;
        }
        .promo-nav-link {
          font-size: 13px; color: #94a3b8;
          text-decoration: none; transition: color 0.2s;
        }
        .promo-nav-link:hover { color: #60a5fa; }

        /* ── Main layout ── */
        .promo-main {
          position: relative; z-index: 1;
          max-width: 1100px; margin: 0 auto;
          padding: 60px 24px 80px;
        }
        .promo-hero {
          display: grid;
          grid-template-columns: 1fr 420px;
          gap: 56px;
          align-items: start;
        }
        @media (max-width: 860px) {
          .promo-hero { grid-template-columns: 1fr; gap: 40px; }
        }

        /* ── Badge ── */
        .promo-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 5px 12px; border-radius: 20px;
          border: 1px solid rgba(59,130,246,0.25);
          background: rgba(59,130,246,0.08);
          font-size: 12px; font-weight: 500; color: #60a5fa;
          margin-bottom: 20px;
        }
        .promo-badge-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 6px #22c55e;
          animation: pulse-dot 2s infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* ── Headline ── */
        .promo-headline {
          font-size: clamp(32px, 5vw, 48px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: #f8fafc;
          margin: 0 0 16px;
        }
        .promo-headline-accent {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .promo-subline {
          font-size: 16px; line-height: 1.7;
          color: #94a3b8; margin: 0 0 28px;
          max-width: 480px;
        }

        /* ── Chart ── */
        .promo-chart-wrap {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 28px;
          box-shadow: 0 4px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.1);
        }
        .promo-chart-overlay {
          position: absolute; bottom: 10px; left: 10px;
          display: flex; gap: 8px;
        }
        .promo-chart-tag {
          display: flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 6px;
          font-size: 11px; font-weight: 600;
        }
        .promo-chart-tag--green {
          background: rgba(16,185,129,0.15);
          color: #34d399; border: 1px solid rgba(16,185,129,0.3);
        }
        .promo-chart-tag--purple {
          background: rgba(139,92,246,0.15);
          color: #a78bfa; border: 1px solid rgba(139,92,246,0.3);
        }
        .promo-chart-tag-dot {
          width: 5px; height: 5px; border-radius: 50%;
        }
        .promo-chart-tag-dot--green { background: #10b981; }

        /* ── Features ── */
        .promo-features { list-style: none; padding: 0; margin: 0 0 28px; }
        .promo-feature-item {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
          font-size: 14px; color: #cbd5e1;
        }
        .promo-feature-item:last-child { border-bottom: none; }
        .promo-feature-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

        /* ── Social proof ── */
        .promo-social-proof { display: flex; align-items: center; gap: 12px; }
        .promo-avatars { display: flex; }
        .promo-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: linear-gradient(135deg, #1e3a5f, #2d1b69);
          border: 2px solid #060c18;
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 700; color: #93c5fd;
          margin-left: -8px;
        }
        .promo-avatar:first-child { margin-left: 0; }
        .promo-social-text { font-size: 13px; color: #64748b; margin: 0; }
        .promo-social-text strong { color: #94a3b8; }

        /* ── Card ── */
        .promo-card {
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 28px;
          backdrop-filter: blur(20px);
          box-shadow:
            0 0 0 1px rgba(59,130,246,0.1),
            0 24px 60px rgba(0,0,0,0.6);
        }
        .promo-card-header {
          display: flex; align-items: center; gap: 14px;
          margin-bottom: 24px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .promo-card-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: rgba(59,130,246,0.12);
          border: 1px solid rgba(59,130,246,0.25);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .promo-card-title { font-size: 18px; font-weight: 700; color: #f1f5f9; margin: 0 0 2px; }
        .promo-card-subtitle { font-size: 13px; color: #64748b; margin: 0; }

        /* ── Form ── */
        .promo-form { display: flex; flex-direction: column; gap: 16px; }
        .promo-field { display: flex; flex-direction: column; gap: 6px; }
        .promo-label { font-size: 13px; font-weight: 500; color: #94a3b8; }
        .promo-input {
          width: 100%; padding: 10px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #e2e8f0; font-size: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none; box-sizing: border-box;
        }
        .promo-input::placeholder { color: #475569; }
        .promo-input:focus {
          border-color: rgba(59,130,246,0.5);
          box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
        }

        /* ── Button ── */
        .promo-btn {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 8px;
          padding: 12px 20px; border-radius: 9px;
          background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
          color: #fff; font-size: 14px; font-weight: 600;
          border: none; cursor: pointer; text-decoration: none;
          transition: opacity 0.2s, transform 0.15s;
          box-shadow: 0 4px 20px rgba(59,130,246,0.3);
        }
        .promo-btn:hover:not(:disabled) { opacity: 0.92; transform: translateY(-1px); }
        .promo-btn:active:not(:disabled) { transform: translateY(0); }
        .promo-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .promo-btn--full { width: 100%; }

        /* ── Spinner ── */
        .promo-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Form footer ── */
        .promo-form-footer { font-size: 12px; color: #475569; text-align: center; margin: 0; }
        .promo-form-link { color: #60a5fa; text-decoration: none; }
        .promo-form-link:hover { text-decoration: underline; }

        /* ── Trust ── */
        .promo-trust {
          display: flex; justify-content: space-around;
          margin-top: 20px; padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .promo-trust-item {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          font-size: 11px; color: #475569; text-align: center;
        }

        /* ── Stats ── */
        .promo-stats {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: rgba(255,255,255,0.06);
          border-radius: 10px; overflow: hidden;
          margin-top: 12px;
          border: 1px solid rgba(255,255,255,0.06);
        }
        .promo-stat {
          background: rgba(15, 23, 42, 0.8);
          padding: 14px 8px;
          display: flex; flex-direction: column; align-items: center; gap: 3px;
        }
        .promo-stat-value {
          font-size: 20px; font-weight: 800;
          background: linear-gradient(135deg, #60a5fa, #a78bfa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .promo-stat-label { font-size: 11px; color: #64748b; }

        /* ── Success state ── */
        .promo-success { text-align: center; padding: 8px 0; }
        .promo-success-icon {
          width: 60px; height: 60px; border-radius: 50%;
          background: rgba(59,130,246,0.1);
          border: 1px solid rgba(59,130,246,0.25);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 20px;
        }
        .promo-success-title { font-size: 22px; font-weight: 700; color: #f1f5f9; margin: 0 0 10px; }
        .promo-success-desc { font-size: 14px; color: #94a3b8; line-height: 1.6; margin: 0 0 24px; }
        .promo-success-email { color: #60a5fa; }
      `}</style>
    </div>
  )
}
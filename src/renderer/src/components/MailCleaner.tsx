import { useState, useEffect } from 'react'
import ScanAnimation from './ui/ScanAnimation'

// ─── Types ─────────────────────────────────────────────────────────────────
// These interfaces are designed for future AI agent integration.
// An agent can generate MailRule[] and pass them to applyRules().

export type MailProvider = 'gmail' | 'outlook' | 'icloud' | 'yahoo'

export interface MailAccount {
  id: string
  provider: MailProvider
  email: string
  label: string
  connected: boolean
  totalEmails?: number
}

export type RuleType = 'promotional' | 'newsletter' | 'old-unread' | 'large' | 'social' | 'custom'

export interface MailRule {
  id: string
  name: string
  type: RuleType
  description: string
  enabled: boolean
  matchCount?: number
  matchSizeBytes?: number
  messageIds?: string[]
}

const ACCENT = '#2EC4B6'

const DEFAULT_RULES: MailRule[] = [
  { id: 'promo',      type: 'promotional', name: 'Promotions & Sales',    description: 'Emails from marketing senders with "sale", "deal", or "offer"', enabled: true },
  { id: 'newsletter', type: 'newsletter',  name: 'Newsletters',           description: 'Subscriptions older than 30 days with unsubscribe links',         enabled: true },
  { id: 'unread-old', type: 'old-unread',  name: 'Old Unread Emails',     description: 'Unread emails more than 90 days old',                             enabled: false },
  { id: 'large',      type: 'large',       name: 'Large Attachments',     description: 'Emails with attachments larger than 5 MB',                        enabled: true },
  { id: 'social',     type: 'social',      name: 'Social Notifications',  description: 'Notifications from social networks and apps',                      enabled: false },
]

// ─── Provider helpers ───────────────────────────────────────────────────────

const PROVIDER_META: Record<MailProvider, { name: string; color: string }> = {
  gmail:   { name: 'Gmail',        color: '#EA4335' },
  outlook: { name: 'Outlook',      color: '#0078D4' },
  icloud:  { name: 'iCloud Mail',  color: '#5BAAFF' },
  yahoo:   { name: 'Yahoo Mail',   color: '#6001D2' },
}

function detectProvider(email: string): MailProvider | null {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  if (['gmail.com', 'googlemail.com'].includes(domain)) return 'gmail'
  if (['outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'outlook.co.uk'].some(d => domain.endsWith(d))) return 'outlook'
  if (['icloud.com', 'me.com', 'mac.com'].includes(domain)) return 'icloud'
  if (domain.startsWith('yahoo.') || domain === 'ymail.com') return 'yahoo'
  return null
}

// ─── SVG provider icons ─────────────────────────────────────────────────────

function GmailIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4h11A2.5 2.5 0 0 1 18 6.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 2 13.5v-7z" fill="white" fillOpacity="0.08" stroke="rgba(234,67,53,0.5)" strokeWidth="1"/>
      <path d="M2 7l8 5 8-5" stroke="#EA4335" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

function OutlookIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="16" height="12" rx="2" fill="rgba(0,120,212,0.15)" stroke="rgba(0,120,212,0.5)" strokeWidth="1"/>
      <circle cx="10" cy="10" r="3.5" stroke="#0078D4" strokeWidth="1.5"/>
    </svg>
  )
}

function ICloudIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path d="M14.5 14H6A4 4 0 1 1 6.5 6.06A5 5 0 1 1 14.5 11a2.5 2.5 0 0 1 0 3z" fill="rgba(91,170,255,0.2)" stroke="#5BAAFF" strokeWidth="1.2"/>
    </svg>
  )
}

function YahooIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <text x="4" y="15" fontFamily="Georgia, serif" fontWeight="bold" fontSize="14" fill="#6001D2">Y!</text>
    </svg>
  )
}

function ProviderIcon({ provider, size = 20 }: { provider: MailProvider; size?: number }) {
  if (provider === 'gmail')   return <GmailIcon size={size} />
  if (provider === 'outlook') return <OutlookIcon size={size} />
  if (provider === 'icloud')  return <ICloudIcon size={size} />
  return <YahooIcon size={size} />
}

// ─── 3D blob envelope hero ──────────────────────────────────────────────────

function BlobMailHero() {
  return (
    <div style={{
      position: 'relative', width: 300, height: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'float 4s ease-in-out infinite'
    }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: `radial-gradient(ellipse, ${ACCENT}28 0%, transparent 70%)`,
        filter: 'blur(28px)'
      }} />
      <div style={{
        width: 240, height: 240,
        borderRadius: '52% 48% 58% 42% / 46% 54% 46% 54%',
        background: `radial-gradient(ellipse at 36% 28%, rgba(70,220,200,0.92) 0%, rgba(20,150,130,0.88) 38%, rgba(6,60,52,0.94) 72%, rgba(2,20,16,0.96) 100%)`,
        boxShadow: `0 30px 80px ${ACCENT}55, 0 0 0 1.5px rgba(100,240,220,0.18) inset, 0 -8px 30px rgba(0,0,0,0.35) inset`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
        animation: 'blob-morph 6s ease-in-out infinite'
      }}>
        <div style={{
          position: 'absolute', top: '10%', left: '16%',
          width: '42%', height: '28%', borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(180,255,245,0.38) 0%, transparent 80%)'
        }} />
        {/* Envelope icon */}
        <svg width="88" height="88" viewBox="0 0 88 88" fill="none"
          style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0 6px 20px rgba(0,50,40,0.5))' }}>
          <rect x="8" y="22" width="72" height="50" rx="8" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.80)" strokeWidth="4"/>
          <path d="M8 30l36 26 36-26" stroke="rgba(255,255,255,0.90)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────

type ViewState = 'landing' | 'adding' | 'setup-creds' | 'waiting-auth' | 'connected' | 'scanning' | 'results' | 'deleting'

export default function MailCleaner() {
  const [view, setView]       = useState<ViewState>('landing')
  const [accounts, setAccounts] = useState<MailAccount[]>([])
  const [rules, setRules]     = useState<MailRule[]>(DEFAULT_RULES)
  const [emailInput, setEmailInput] = useState('')
  const [detectedProvider, setDetectedProvider] = useState<MailProvider | null>(null)
  const [connectError, setConnectError] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [scanningLabel, setScanningLabel] = useState('')
  const [credentialsPath, setCredentialsPath] = useState('')
  const [deleteProgress, setDeleteProgress] = useState(0) // 0–100, shown in deleting view

  // Load previously connected accounts on mount
  useEffect(() => {
    window.electron.gmail.getAccounts().then(accts => {
      if (accts.length > 0) {
        setAccounts(accts.map(a => ({
          id: `gmail-${a.email}`,
          provider: 'gmail' as MailProvider,
          email: a.email,
          label: 'Gmail',
          connected: true,
          totalEmails: a.totalMessages,
        })))
        setView('connected')
      }
    }).catch(() => {})
  }, [])

  const handleEmailChange = (val: string) => {
    setEmailInput(val)
    setDetectedProvider(detectProvider(val))
    setConnectError('')
  }

  const handleContinue = async () => {
    const provider = detectedProvider ?? (emailInput.includes('@') ? detectProvider(emailInput) : null) ?? 'gmail'

    if (provider === 'gmail') {
      // Real Gmail OAuth
      setConnecting(true)
      try {
        const hasCreds = await window.electron.gmail.hasCredentials()
        if (!hasCreds) {
          const path = await window.electron.gmail.credentialsPath()
          setCredentialsPath(path)
          setConnecting(false)
          setView('setup-creds')
          return
        }
        setConnecting(false)
        setView('waiting-auth')
        // Opens system browser; resolves when OAuth callback received
        const email = await window.electron.gmail.startAuth()
        const accts = await window.electron.gmail.getAccounts()
        const matched = accts.find(a => a.email === email)
        if (matched) {
          setAccounts(prev => {
            const without = prev.filter(a => a.email !== email)
            return [...without, {
              id: `gmail-${email}`, provider: 'gmail', email,
              label: 'Gmail', connected: true, totalEmails: matched.totalMessages,
            }]
          })
        }
        setEmailInput(''); setDetectedProvider(null)
        setView('connected')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Connection failed'
        setConnectError(msg === 'Auth timeout' ? 'Authentication timed out. Please try again.' : msg)
        setConnecting(false)
        setView('adding')
      }
    } else {
      // Outlook / iCloud / Yahoo: placeholder — real IMAP TBD
      if (!emailInput.includes('@')) { setConnectError('Enter a valid email address'); return }
      setConnecting(true)
      await new Promise(r => setTimeout(r, 800))
      setAccounts(prev => [...prev, {
        id: `${provider}-${Date.now()}`, provider, email: emailInput,
        label: PROVIDER_META[provider].name, connected: true,
      }])
      setEmailInput(''); setDetectedProvider(null)
      setConnecting(false)
      setView('connected')
    }
  }

  // ── Real Gmail scan ─────────────────────────────────────────────────────
  const runScan = async () => {
    const activeAccount = accounts.find(a => a.provider === 'gmail')
    if (!activeAccount) return
    setView('scanning')
    setScanningLabel(activeAccount.email)
    try {
      const results = await window.electron.gmail.scan(
        activeAccount.email,
        rules.map(r => ({ id: r.id, type: r.type, enabled: r.enabled }))
      )
      setRules(prev => prev.map(r => {
        const match = results.find(res => res.ruleId === r.id)
        return match ? { ...r, matchCount: match.count, matchSizeBytes: match.sizeBytes, messageIds: match.messageIds } : r
      }))
      setView('results')
    } catch (e) {
      console.error('Gmail scan failed:', e)
      setView('connected')
    }
  }

  const toggleRule = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  // ── Real Gmail deletion ─────────────────────────────────────────────────
  const deleteMatched = async (ruleId?: string) => {
    const activeAccount = accounts.find(a => a.provider === 'gmail')
    if (!activeAccount) return
    const toDelete = rules
      .filter(r => (!ruleId || r.id === ruleId) && (r.messageIds?.length ?? 0) > 0)
      .flatMap(r => r.messageIds ?? [])
    if (toDelete.length === 0) {
      // No real IDs (non-Gmail account) — just clear counts
      setRules(prev => prev.map(r => (!ruleId || r.id === ruleId) ? { ...r, matchCount: 0, matchSizeBytes: 0, messageIds: [] } : r))
      return
    }
    setView('deleting')
    setDeleteProgress(0)
    const result = await window.electron.gmail.delete(activeAccount.email, toDelete)
    if (!result.cancelled) {
      setRules(prev => prev.map(r =>
        (!ruleId || r.id === ruleId) ? { ...r, matchCount: 0, matchSizeBytes: 0, messageIds: [] } : r
      ))
    }
    setView('results')
  }

  const totalMatched    = rules.reduce((s, r) => s + (r.matchCount ?? 0), 0)
  const totalMatchBytes = rules.reduce((s, r) => s + (r.matchSizeBytes ?? 0), 0)

  function fmtBytes(n: number) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB'
    if (n >= 1e6) return (n / 1e6).toFixed(0) + ' MB'
    return (n / 1e3).toFixed(0) + ' KB'
  }
  function fmtCount(n: number) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return String(n)
  }

  // ── Rule type icon ──────────────────────────────────────────────────────
  function RuleIcon({ type }: { type: RuleType }) {
    const paths: Record<RuleType, string> = {
      promotional: 'M3 3h14l-7 6-7-6zM3 3v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3M9 11v4M12 9v6',
      newsletter:  'M2 5h14M2 9h10M2 13h7',
      'old-unread':'M9 2a7 7 0 1 0 0 14A7 7 0 0 0 9 2zM9 5v4l3 2',
      large:       'M3 7h12M7 3l-4 4 4 4M13 11l4-4-4-4',
      social:      'M12 12c2 0 4-1 4-3s-2-3-4-3a5 5 0 0 0-5 5c0 2 1 4 3 4M6 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      custom:      'M2 6h12M2 10h8M2 14h10',
    }
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d={paths[type]}/>
      </svg>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render: SETUP CREDENTIALS (no Google credentials JSON found)
  // ────────────────────────────────────────────────────────────────────────
  if (view === 'setup-creds') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 540, padding: '44px 48px', borderRadius: 22, background: 'rgba(10,6,28,0.90)', border: '1px solid rgba(46,196,182,0.22)', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(46,196,182,0.14)', border: '1px solid rgba(46,196,182,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round"><circle cx="14" cy="14" r="10"/><path d="M14 8v6l4 2"/></svg>
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>Set up Google credentials</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 28 }}>
            MacSweeper uses your own Google API credentials to access Gmail. Your emails stay on your device — nothing is sent to any server.
          </p>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12, padding: '18px 20px', marginBottom: 28, fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: 'rgba(255,255,255,0.85)' }}>One-time setup (2 minutes):</div>
            {[
              '1. Go to console.cloud.google.com and create a project',
              '2. Enable the Gmail API (APIs & Services → Library)',
              '3. Create OAuth 2.0 credentials → Desktop app',
              '4. Download the credentials JSON file',
              `5. Place it at:\n   ${credentialsPath}`,
              '6. Click "Done, try again" below',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, color: 'rgba(255,255,255,0.70)', lineHeight: 1.5 }}>
                <span style={{ color: ACCENT, flexShrink: 0, fontWeight: 600 }}>·</span>
                <span style={{ whiteSpace: 'pre-wrap' }}>{step}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setView('adding')} style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer' }}>Back</button>
            <button onClick={handleContinue} style={{ flex: 1, padding: '11px', borderRadius: 10, background: `linear-gradient(135deg, ${ACCENT}, #22a89a)`, border: 'none', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Done, try again</button>
          </div>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render: WAITING FOR BROWSER AUTH
  // ────────────────────────────────────────────────────────────────────────
  if (view === 'waiting-auth') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(234,67,53,0.14)', border: '1px solid rgba(234,67,53,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', position: 'relative' }}>
            <GmailIcon size={32}/>
            <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#EA4335', animation: 'spin 1.2s linear infinite' }}/>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Sign in with Google</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.50)', lineHeight: 1.7, marginBottom: 28 }}>
            A browser window has opened. Complete the Google sign-in, then return here.
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)' }}>Waiting for authentication… (up to 5 minutes)</p>
          <button onClick={() => { setView('adding'); setConnecting(false) }} style={{ marginTop: 24, background: 'none', border: 'none', color: 'rgba(255,255,255,0.38)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Cancel</button>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render: LANDING
  // ────────────────────────────────────────────────────────────────────────
  if (view === 'landing') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', gap: 0 }}>
        {/* Left: 3D blob */}
        <div style={{ flex: '0 0 50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <BlobMailHero />
        </div>

        {/* Right: title + provider buttons */}
        <div style={{ flex: '0 0 50%', paddingRight: 16 }}>
          <h1 style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 10 }}>
            Mail Cleaner
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 36, maxWidth: 340 }}>
            Automatically find and remove promotional emails, newsletters, and clutter from your inbox.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {(['gmail', 'outlook', 'icloud', 'yahoo'] as MailProvider[]).map(p => (
              <button
                key={p}
                onClick={() => { setDetectedProvider(p); setView('adding') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 14, cursor: 'pointer',
                  transition: 'all 0.15s', textAlign: 'left'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 8, background: `${PROVIDER_META[p].color}22`, border: `1px solid ${PROVIDER_META[p].color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ProviderIcon provider={p} size={18} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.88)' }}>
                  Connect {PROVIDER_META[p].name}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" style={{ marginLeft: 'auto' }}>
                  <path d="M4.5 3l3 3-3 3"/>
                </svg>
              </button>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', lineHeight: 1.5, maxWidth: 320 }}>
            Your credentials are used only to read email metadata locally. Nothing is sent to external servers.
          </p>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render: ADD ACCOUNT MODAL
  // ────────────────────────────────────────────────────────────────────────
  if (view === 'adding') {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 420,
          background: 'rgba(15,15,25,0.92)',
          border: '1px solid rgba(255,255,255,0.14)',
          borderRadius: 22,
          padding: '40px 40px 36px',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.6)'
        }}>
          {/* Provider icons row */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
            {(['gmail', 'outlook', 'icloud', 'yahoo'] as MailProvider[]).map(p => (
              <div
                key={p}
                onClick={() => setDetectedProvider(p)}
                style={{
                  width: 40, height: 40, borderRadius: 10, cursor: 'pointer',
                  background: detectedProvider === p ? `${PROVIDER_META[p].color}22` : 'rgba(255,255,255,0.06)',
                  border: `1.5px solid ${detectedProvider === p ? PROVIDER_META[p].color + '66' : 'rgba(255,255,255,0.10)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s'
                }}
              >
                <ProviderIcon provider={p} size={20} />
              </div>
            ))}
          </div>

          <h2 style={{ fontSize: 26, fontWeight: 700, textAlign: 'center', marginBottom: 6 }}>Add an Account</h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginBottom: 28 }}>
            Enter your email address
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginBottom: 24, lineHeight: 1.6 }}>
            Add your Gmail, Outlook.com, Microsoft 365, iCloud, Yahoo, IMAP, or POP accounts.
          </p>

          {/* Email input */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.3" strokeLinecap="round" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
              <rect x="1" y="3" width="14" height="10" rx="2"/>
              <path d="M1 6l7 4 7-4"/>
            </svg>
            <input
              type="email"
              value={emailInput}
              onChange={e => handleEmailChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleContinue()}
              placeholder="Email address"
              autoFocus
              style={{
                width: '100%', padding: '13px 14px 13px 38px',
                background: 'rgba(255,255,255,0.07)',
                border: `1px solid ${connectError ? 'rgba(255,69,58,0.6)' : 'rgba(255,255,255,0.18)'}`,
                borderRadius: 12, color: 'white', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.15s'
              }}
              onFocus={e => e.target.style.borderColor = `${ACCENT}88`}
              onBlur={e => e.target.style.borderColor = connectError ? 'rgba(255,69,58,0.6)' : 'rgba(255,255,255,0.18)'}
            />
            {detectedProvider && (
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                <ProviderIcon provider={detectedProvider} size={16} />
              </div>
            )}
          </div>

          {connectError && (
            <p style={{ fontSize: 12, color: '#ff7b72', marginBottom: 12, paddingLeft: 4 }}>{connectError}</p>
          )}

          <button
            onClick={handleContinue}
            disabled={connecting}
            style={{
              width: '100%', padding: '13px',
              background: connecting ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg, ${ACCENT}, #1A9E94)`,
              border: 'none', borderRadius: 12, color: 'white',
              fontSize: 15, fontWeight: 700, cursor: connecting ? 'not-allowed' : 'pointer',
              marginBottom: 16, transition: 'opacity 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            {connecting
              ? <><span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span> Connecting…</>
              : 'Continue'}
          </button>

          <button
            onClick={() => setView(accounts.length > 0 ? 'connected' : 'landing')}
            style={{ display: 'block', width: '100%', background: 'none', border: 'none', color: `${ACCENT}CC`, fontSize: 13, cursor: 'pointer', textAlign: 'center' }}
          >
            {accounts.length > 0 ? 'Back to accounts' : 'Cancel'}
          </button>
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render: DELETING
  // ────────────────────────────────────────────────────────────────────────
  if (view === 'deleting') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#ff7b72" strokeWidth="1.8" strokeLinecap="round"><path d="M5 7h18M10 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 7l-1 14H10L9 7"/><path d="M12 12v5M16 12v5"/></svg>
          <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#ff7b72', animation: 'spin 1.2s linear infinite' }}/>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Deleting emails…</p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)' }}>Moving messages to Trash</p>
        </div>
        {deleteProgress > 0 && (
          <div style={{ width: 260, height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${deleteProgress}%`, background: '#ff7b72', borderRadius: 2, transition: 'width 0.3s' }}/>
          </div>
        )}
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render: SCANNING
  // ────────────────────────────────────────────────────────────────────────
  if (view === 'scanning') {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <ScanAnimation accent={ACCENT} label={`Scanning ${scanningLabel}`} />
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', marginTop: -12 }}>Applying your cleanup rules…</p>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render: RESULTS
  // ────────────────────────────────────────────────────────────────────────
  if (view === 'results') {
    const hasMatches = totalMatched > 0
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 4 }}>Scan Results</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
              {hasMatches
                ? `Found ${fmtCount(totalMatched)} emails · ${fmtBytes(totalMatchBytes)} to clean`
                : 'Your inbox looks clean'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {hasMatches && (
              <button
                onClick={() => deleteMatched()}
                style={{
                  padding: '9px 18px', borderRadius: 10,
                  background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.35)',
                  color: '#ff7b72', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                }}
              >
                Delete All ({fmtCount(totalMatched)})
              </button>
            )}
            <button
              onClick={() => setView('connected')}
              style={{ padding: '9px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer' }}
            >
              Edit Rules
            </button>
            <button
              onClick={runScan}
              style={{ padding: '9px 18px', borderRadius: 10, background: `linear-gradient(135deg, ${ACCENT}, #1A9E94)`, border: 'none', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Rescan
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
          {rules.filter(r => r.enabled).map(rule => (
            <div key={rule.id} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 20px',
              background: 'rgba(0,0,0,0.22)',
              border: `1px solid ${(rule.matchCount ?? 0) > 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 14, transition: 'all 0.15s'
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: `${ACCENT}18`, border: `1px solid ${ACCENT}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: ACCENT
              }}>
                <RuleIcon type={rule.type} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{rule.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>{rule.description}</div>
              </div>
              {(rule.matchCount ?? 0) > 0 ? (
                <>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtCount(rule.matchCount!)}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      {fmtBytes(rule.matchSizeBytes!)}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteMatched(rule.id)}
                    style={{
                      padding: '7px 14px', borderRadius: 9, flexShrink: 0,
                      background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.28)',
                      color: '#ff7b72', fontSize: 12, fontWeight: 500, cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'rgba(80,200,140,0.8)', fontWeight: 500 }}>Clean</div>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ────────────────────────────────────────────────────────────────────────
  // Render: CONNECTED — accounts list + rules + scan button
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 3 }}>Mail Cleaner</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setView('adding')}
            style={{ padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 2v8M2 6h8"/></svg>
            Add Account
          </button>
          <button
            onClick={runScan}
            style={{ padding: '9px 22px', borderRadius: 10, background: `linear-gradient(135deg, ${ACCENT}, #1A9E94)`, border: 'none', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 20px ${ACCENT}44` }}
          >
            Scan Inbox
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        {/* Left: accounts */}
        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Accounts</h3>
          {accounts.map(acc => (
            <div key={acc.id} style={{
              padding: '14px 16px',
              background: 'rgba(0,0,0,0.22)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: `${PROVIDER_META[acc.provider].color}18`,
                border: `1px solid ${PROVIDER_META[acc.provider].color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <ProviderIcon provider={acc.provider} size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.email}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>
                  {acc.totalEmails?.toLocaleString()} emails
                </div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#30D158', flexShrink: 0 }} />
            </div>
          ))}
        </div>

        {/* Right: rules */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, flexShrink: 0 }}>
            Cleanup Rules
            <span style={{ marginLeft: 8, fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
              — select rules, then Scan Inbox
            </span>
          </h3>
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rules.map(rule => (
              <div
                key={rule.id}
                onClick={() => toggleRule(rule.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 18px',
                  background: rule.enabled ? 'rgba(46,196,182,0.08)' : 'rgba(0,0,0,0.18)',
                  border: `1px solid ${rule.enabled ? `${ACCENT}30` : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 13, cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: rule.enabled ? `${ACCENT}1C` : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${rule.enabled ? `${ACCENT}35` : 'rgba(255,255,255,0.10)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: rule.enabled ? ACCENT : 'rgba(255,255,255,0.35)'
                }}>
                  <RuleIcon type={rule.type} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: rule.enabled ? 600 : 400, color: rule.enabled ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.55)', marginBottom: 2 }}>
                    {rule.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', lineHeight: 1.4 }}>{rule.description}</div>
                </div>
                {/* Toggle */}
                <div style={{
                  width: 36, height: 20, borderRadius: 10, flexShrink: 0,
                  background: rule.enabled ? ACCENT : 'rgba(255,255,255,0.15)',
                  position: 'relative', transition: 'background 0.2s'
                }}>
                  <div style={{
                    position: 'absolute', top: 2,
                    left: rule.enabled ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'white',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)'
                  }} />
                </div>
              </div>
            ))}

            {/* Add custom rule placeholder */}
            <button
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 18px',
                background: 'transparent',
                border: '1px dashed rgba(255,255,255,0.15)',
                borderRadius: 13, cursor: 'pointer', color: 'rgba(255,255,255,0.35)',
                fontSize: 13, transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${ACCENT}44`; e.currentTarget.style.color = ACCENT }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 2v10M2 7h10"/></svg>
              Add Custom Rule
              <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.6 }}>AI agent ready</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

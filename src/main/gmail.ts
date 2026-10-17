/**
 * Gmail OAuth 2.0 integration.
 *
 * Setup: place your Google OAuth Desktop credentials JSON at
 *   <userData>/google-credentials.json
 * (the file downloaded from Google Cloud Console → OAuth 2.0 Client IDs → Desktop app)
 *
 * The file should be the raw JSON from Google, e.g.:
 *   { "installed": { "client_id": "...", "client_secret": "...", ... } }
 */

import { app, shell } from 'electron'
import http from 'http'
import path from 'path'
import fs from 'fs'
import { google } from 'googleapis'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://mail.google.com/', // required for batchDelete
]

const TOKEN_PATH = path.join(app.getPath('userData'), 'gmail-tokens.json')
const CREDS_PATH = path.join(app.getPath('userData'), 'google-credentials.json')

// ── Credential / token helpers ─────────────────────────────────────────────

type TokenStore = Record<string, object>

function loadTokens(): TokenStore {
  try { return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8')) } catch { return {} }
}

function saveTokens(store: TokenStore) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(store, null, 2))
}

function loadCredentials(): { client_id: string; client_secret: string } | null {
  try {
    const raw = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'))
    const creds = raw.installed ?? raw.web
    if (!creds?.client_id) return null
    return { client_id: creds.client_id, client_secret: creds.client_secret }
  } catch { return null }
}

function makeOAuth(redirectUri?: string) {
  const creds = loadCredentials()
  if (!creds) throw new Error('NO_CREDENTIALS')
  return new google.auth.OAuth2(creds.client_id, creds.client_secret, redirectUri)
}

function authedClient(email: string) {
  const store = loadTokens()
  if (!store[email]) throw new Error('NO_TOKEN')
  const auth = makeOAuth()
  auth.setCredentials(store[email])
  auth.on('tokens', newTokens => {
    // Persist refreshed tokens automatically
    const fresh = loadTokens()
    fresh[email] = { ...(fresh[email] as object), ...newTokens }
    saveTokens(fresh)
  })
  return auth
}

// ── Auth flow ─────────────────────────────────────────────────────────────────

export function getCredentialsPath() { return CREDS_PATH }
export function hasCredentials() { return loadCredentials() !== null }

/**
 * Opens the system browser for Gmail OAuth.
 * Returns a promise that resolves with the authed email when done.
 */
export async function startGmailAuth(): Promise<string> {
  const creds = loadCredentials()
  if (!creds) throw new Error('NO_CREDENTIALS')

  return new Promise<string>((resolve, reject) => {
    // Temporary local server to catch the OAuth redirect
    const server = http.createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (!addr || typeof addr === 'string') { reject(new Error('Server failed')); return }
      const port = addr.port
      const redirectUri = `http://127.0.0.1:${port}`
      const auth = makeOAuth(redirectUri)

      const authUrl = auth.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
      })

      // Open the auth URL in the user's default browser
      shell.openExternal(authUrl)

      let handled = false
      server.on('request', async (req, res) => {
        if (handled) return
        handled = true

        const html = (msg: string) =>
          `<html><body style="font-family:sans-serif;padding:32px"><h2>${msg}</h2><p>You can close this tab.</p></body></html>`

        const url = new URL(req.url ?? '/', redirectUri)
        const code = url.searchParams.get('code')
        const error = url.searchParams.get('error')

        if (error || !code) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(html('Authentication cancelled.'))
          server.close()
          reject(new Error(error ?? 'No auth code'))
          return
        }

        try {
          const { tokens } = await auth.getToken(code)
          auth.setCredentials(tokens)

          // Get the email address
          const gmail = google.gmail({ version: 'v1', auth })
          const profile = await gmail.users.getProfile({ userId: 'me' })
          const email = profile.data.emailAddress!

          // Persist tokens keyed by email
          const store = loadTokens()
          store[email] = tokens
          saveTokens(store)

          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(html(`Connected as ${email}!`))
          server.close()
          resolve(email)
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'text/html' })
          res.end(html('Authentication error.'))
          server.close()
          reject(e)
        }
      })

      // Timeout after 5 minutes
      setTimeout(() => {
        if (!handled) {
          server.close()
          reject(new Error('Auth timeout'))
        }
      }, 5 * 60 * 1000)
    })
  })
}

// ── Account management ────────────────────────────────────────────────────────

export interface GmailAccount {
  email: string
  provider: 'gmail'
  totalMessages?: number
}

export async function getConnectedAccounts(): Promise<GmailAccount[]> {
  const store = loadTokens()
  const emails = Object.keys(store)
  const accounts: GmailAccount[] = []
  for (const email of emails) {
    try {
      const auth = authedClient(email)
      const gmail = google.gmail({ version: 'v1', auth })
      const profile = await gmail.users.getProfile({ userId: 'me' })
      accounts.push({ email, provider: 'gmail', totalMessages: profile.data.messagesTotal ?? 0 })
    } catch {
      // Token may be expired/revoked — keep in list but without count
      accounts.push({ email, provider: 'gmail' })
    }
  }
  return accounts
}

export function disconnectAccount(email: string) {
  const store = loadTokens()
  delete store[email]
  saveTokens(store)
}

// ── Email scanning ────────────────────────────────────────────────────────────

function ruleToQuery(type: string): string {
  switch (type) {
    case 'promotional':
      return 'category:promotions OR (subject:(sale OR deal OR offer OR discount OR coupon) -in:sent -in:drafts)'
    case 'newsletter':
      return '(list:* OR unsubscribe) older_than:30d -in:sent'
    case 'old-unread':
      return 'is:unread older_than:90d -in:sent -in:drafts'
    case 'large':
      return 'has:attachment size:5000000'
    case 'social':
      return 'category:social OR from:(facebook.com OR twitter.com OR linkedin.com OR instagram.com OR tiktok.com OR pinterest.com)'
    default:
      return ''
  }
}

export interface ScanRule { id: string; type: string; enabled: boolean }

export interface EmailMatch {
  ruleId: string
  count: number
  sizeBytes: number
  messageIds: string[]
}

export async function scanEmailsByRules(email: string, rules: ScanRule[]): Promise<EmailMatch[]> {
  const auth = authedClient(email)
  const gmail = google.gmail({ version: 'v1', auth })
  const results: EmailMatch[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue
    const q = ruleToQuery(rule.type)
    if (!q) continue

    try {
      // Fetch up to 500 IDs — enough for UX; full delete uses resultSizeEstimate
      const listRes = await gmail.users.messages.list({ userId: 'me', q, maxResults: 500 })
      const messages = listRes.data.messages ?? []
      const totalCount = listRes.data.resultSizeEstimate ?? messages.length
      const messageIds = messages.map(m => m.id!).filter(Boolean)

      // Sample up to 20 messages for size estimation
      let sizeBytes = 0
      const sampleIds = messageIds.slice(0, 20)
      for (const id of sampleIds) {
        try {
          const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'minimal' })
          sizeBytes += msg.data.sizeEstimate ?? 0
        } catch { /* skip */ }
      }
      // Extrapolate to full count
      if (sampleIds.length > 0 && totalCount > sampleIds.length) {
        sizeBytes = Math.round((sizeBytes / sampleIds.length) * totalCount)
      }

      results.push({ ruleId: rule.id, count: totalCount, sizeBytes, messageIds })
    } catch (e) {
      console.error(`Gmail scan failed for rule ${rule.id}:`, e)
      results.push({ ruleId: rule.id, count: 0, sizeBytes: 0, messageIds: [] })
    }
  }
  return results
}

// ── Email deletion ────────────────────────────────────────────────────────────

export async function deleteEmails(
  email: string,
  messageIds: string[],
  onProgress?: (done: number, total: number) => void
): Promise<{ deleted: number; failed: number }> {
  const auth = authedClient(email)
  const gmail = google.gmail({ version: 'v1', auth })
  let deleted = 0, failed = 0
  const BATCH = 50

  for (let i = 0; i < messageIds.length; i += BATCH) {
    const batch = messageIds.slice(i, i + BATCH)
    try {
      await gmail.users.messages.batchDelete({ userId: 'me', requestBody: { ids: batch } })
      deleted += batch.length
    } catch {
      // Fall back to individual trashing
      for (const id of batch) {
        try {
          await gmail.users.messages.trash({ userId: 'me', id })
          deleted++
        } catch { failed++ }
      }
    }
    onProgress?.(deleted + failed, messageIds.length)
  }
  return { deleted, failed }
}

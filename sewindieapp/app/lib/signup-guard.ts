import crypto from "crypto"

export const TURNSTILE_SIGNUP_ACTION = "signup"

const MIN_FILL_MS = 3_000
const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1000

const SIGNUP_RATE_LIMIT_MAX = 3
const SIGNUP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

// Most-abused throwaway providers. Not exhaustive by design — the goal is to
// raise the cost of bulk signups, not to perfectly classify every domain.
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "20minutemail.com",
  "33mail.com",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getairmail.com",
  "getnada.com",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "inboxbear.com",
  "maildrop.cc",
  "mailinator.com",
  "mailinator.net",
  "mailnesia.com",
  "mintemail.com",
  "mohmal.com",
  "mytemp.email",
  "nada.email",
  "sharklasers.com",
  "spam4.me",
  "spamgourmet.com",
  "temp-mail.io",
  "temp-mail.org",
  "tempail.com",
  "tempmail.com",
  "tempmail.dev",
  "tempmail.net",
  "tempmailo.com",
  "tempr.email",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.de",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
])

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const LINK_PATTERN = /(https?:\/\/|www\.|\.(com|net|org|ru|cn|xyz|top|info|biz|io|link|click)\b)/i

function formSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to sign signup form tokens")
  return secret
}

function sign(value: string): string {
  return crypto.createHmac("sha256", formSecret()).update(`signup-form:${value}`).digest("hex")
}

export function createFormToken(now = Date.now()): string {
  const issuedAt = String(now)
  return `${issuedAt}.${sign(issuedAt)}`
}

export type FormTokenResult = "ok" | "invalid" | "too-fast" | "expired"

export function checkFormToken(token: unknown, now = Date.now()): FormTokenResult {
  if (typeof token !== "string") return "invalid"
  const [issuedAt, signature] = token.split(".")
  if (!issuedAt || !signature) return "invalid"

  const expected = Buffer.from(sign(issuedAt), "hex")
  const provided = Buffer.from(signature, "hex")
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return "invalid"
  }

  const age = now - Number(issuedAt)
  if (!Number.isFinite(age) || age < 0) return "invalid"
  if (age < MIN_FILL_MS) return "too-fast"
  if (age > MAX_FORM_AGE_MS) return "expired"
  return "ok"
}

// Per-instance only (not shared across serverless instances). It still blunts
// bursts from a single IP; a shared store like Redis would make it global.
const signupLog = new Map<string, number[]>()

export function isSignupRateLimited(ip: string, now = Date.now()): boolean {
  const windowStart = now - SIGNUP_RATE_LIMIT_WINDOW_MS
  const recent = (signupLog.get(ip) || []).filter((t) => t > windowStart)

  if (recent.length >= SIGNUP_RATE_LIMIT_MAX) {
    signupLog.set(ip, recent)
    return true
  }

  recent.push(now)
  signupLog.set(ip, recent)

  if (signupLog.size > 10_000) {
    for (const [key, times] of signupLog) {
      if (times.every((t) => t <= windowStart)) signupLog.delete(key)
    }
  }
  return false
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for")
  if (forwardedFor) return forwardedFor.split(",")[0].trim()
  return req.headers.get("x-real-ip") || "unknown"
}

export async function verifySignupTurnstile(token: string, ip: string, requestHost: string | null) {
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
      ...(ip !== "unknown" ? { remoteip: ip } : {}),
      idempotency_key: crypto.randomUUID(),
    }),
  })

  const data: {
    success?: boolean
    action?: string
    hostname?: string
    "error-codes"?: string[]
  } = await response.json()

  if (data.success !== true) {
    return { ok: false, reason: `siteverify failed: ${(data["error-codes"] || []).join(",")}` }
  }

  // A token solved for another form (e.g. forgot-password) or on another host
  // must not be accepted for account creation.
  if (data.action !== TURNSTILE_SIGNUP_ACTION) {
    return { ok: false, reason: `unexpected action: ${data.action}` }
  }

  const host = requestHost?.split(":")[0].toLowerCase()
  if (host && data.hostname && data.hostname.toLowerCase() !== host) {
    return { ok: false, reason: `hostname mismatch: ${data.hostname} vs ${host}` }
  }

  return { ok: true as const }
}

export type SignupInput = { name: string; email: string; password: string }

export function validateSignupInput(body: Record<string, unknown>):
  | { ok: true; value: SignupInput }
  | { ok: false; message: string } {
  const name = typeof body.name === "string" ? body.name.trim() : ""
  // Casing is kept as typed because login looks the email up exactly.
  const email = typeof body.email === "string" ? body.email.trim() : ""
  const password = typeof body.password === "string" ? body.password : ""

  if (!name || name.length > 60) {
    return { ok: false, message: "Please enter a name (60 characters or fewer)." }
  }
  if (LINK_PATTERN.test(name) || /[<>]/.test(name)) {
    return { ok: false, message: "Names can't contain links or special markup." }
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { ok: false, message: "Please enter a valid email address." }
  }

  const domain = email.split("@")[1].toLowerCase()
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return { ok: false, message: "Please use a permanent email address, not a temporary one." }
  }

  if (password.length < 8 || password.length > 128) {
    return { ok: false, message: "Password must be between 8 and 128 characters." }
  }

  return { ok: true, value: { name, email, password } }
}

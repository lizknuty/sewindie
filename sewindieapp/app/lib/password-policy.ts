import { createHash } from "crypto"

export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128
export const PASSWORD_HINT = `Use at least ${PASSWORD_MIN_LENGTH} characters. A short phrase of a few words works well.`

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password12", "password123", "password1234", "passw0rd",
  "1234567890", "12345678910", "0123456789", "qwertyuiop", "qwerty1234", "qwerty12345",
  "1q2w3e4r5t", "1qaz2wsx3edc", "abcdefghij", "abc1234567", "iloveyou12", "letmein123",
  "welcome123", "sunshine12", "princess12", "football12", "monkey1234", "dragon1234",
  "trustno1234", "baseball12", "superman12", "starwars12", "changeme12", "admin12345",
  "sewindie", "sewindie123", "sewindie1234", "sewing1234", "sewing12345", "patterns123",
])

type PasswordContext = { email?: string | null; name?: string | null }

export type PasswordCheck = { ok: true } | { ok: false; message: string }

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** Fast, synchronous rules. Safe to run before any network or DB work. */
export function checkPasswordRules(password: unknown, context: PasswordContext = {}): PasswordCheck {
  if (typeof password !== "string") {
    return { ok: false, message: "Please enter a password." }
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` }
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, message: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.` }
  }

  const flat = normalize(password)
  if (new Set(password).size < 4) {
    return { ok: false, message: "Password is too repetitive. Try mixing in more characters or words." }
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase()) || COMMON_PASSWORDS.has(flat)) {
    return { ok: false, message: "That password is too common. Please choose something less predictable." }
  }

  const emailLocal = context.email ? normalize(context.email.split("@")[0] ?? "") : ""
  const name = context.name ? normalize(context.name) : ""
  if ((emailLocal.length >= 4 && flat.includes(emailLocal)) || (name.length >= 4 && flat.includes(name))) {
    return { ok: false, message: "Password shouldn't contain your name or email address." }
  }

  return { ok: true }
}

/**
 * Checks Have I Been Pwned using k-anonymity: only the first 5 hex chars of the
 * SHA-1 hash leave the server. Fails open so an outage never blocks sign-ups.
 */
export async function isBreachedPassword(password: string): Promise<boolean> {
  const hash = createHash("sha1").update(password).digest("hex").toUpperCase()
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "SewIndie-password-check" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    })
    if (!res.ok) return false
    const body = await res.text()
    return body.split("\n").some((line) => {
      const [candidate, count] = line.trim().split(":")
      return candidate === suffix && Number(count) > 0
    })
  } catch (error) {
    console.warn("[password-policy] breach check unavailable", (error as Error).message)
    return false
  }
}

/** Full policy: sync rules first, then the breach lookup. */
export async function validateNewPassword(password: unknown, context: PasswordContext = {}): Promise<PasswordCheck> {
  const rules = checkPasswordRules(password, context)
  if (!rules.ok) return rules
  if (await isBreachedPassword(password as string)) {
    return {
      ok: false,
      message: "This password has appeared in a known data breach. Please choose a different one.",
    }
  }
  return { ok: true }
}

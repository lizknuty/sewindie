import crypto from "crypto"
import { Resend } from "resend"
import { prisma } from "@/lib/prisma"
import { getVerifyEmailTemplate } from "@/lib/email-templates"

export const EMAIL_NOT_VERIFIED_ERROR = "EMAIL_NOT_VERIFIED"

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const RESEND_COOLDOWN_MS = 60 * 1000

const resend = new Resend(process.env.RESEND_API_KEY)

// Only the hash is stored, so a leaked database row can't be turned into a working link.
export function hashVerificationToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex")
}

// Links are built from configured URLs, never the request's Origin/Host header, so an attacker
// can't trigger a verification email pointing at their own domain.
function getAppOrigin(req: Request) {
  const configured = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL
  return (configured ? new URL(configured) : new URL(req.url)).origin
}

type VerifiableUser = {
  id: number
  email: string
  name: string | null
  emailVerificationExpires: Date | null
}

export function isWithinResendCooldown(user: Pick<VerifiableUser, "emailVerificationExpires">) {
  if (!user.emailVerificationExpires) return false
  const issuedAt = user.emailVerificationExpires.getTime() - TOKEN_TTL_MS
  return Date.now() - issuedAt < RESEND_COOLDOWN_MS
}

export async function issueVerificationEmail(user: VerifiableUser, req: Request): Promise<boolean> {
  const token = crypto.randomBytes(32).toString("hex")

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: hashVerificationToken(token),
      emailVerificationExpires: new Date(Date.now() + TOKEN_TTL_MS),
    },
  })

  const verifyUrl = `${getAppOrigin(req)}/verify-email/${token}`
  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "noreply@sewindie.com",
    to: user.email,
    subject: "Confirm your SewIndie email",
    html: getVerifyEmailTemplate(verifyUrl, user.name || undefined),
  })

  if (error) {
    console.error("[email-verification] Resend failed", { userId: user.id, error })
    return false
  }
  return true
}

export type VerifyResult = "verified" | "invalid" | "expired"

export async function consumeVerificationToken(token: string): Promise<VerifyResult> {
  if (!/^[a-f0-9]{64}$/.test(token)) return "invalid"

  const user = await prisma.user.findFirst({
    where: { emailVerificationToken: hashVerificationToken(token) },
    select: { id: true, emailVerificationExpires: true },
  })
  if (!user) return "invalid"
  if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) return "expired"

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date(), emailVerificationToken: null, emailVerificationExpires: null },
  })
  return "verified"
}

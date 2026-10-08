import type { Metadata } from "next"
import Link from "next/link"
import { consumeVerificationToken, type VerifyResult } from "@/lib/email-verification"

export const metadata: Metadata = {
  title: "Confirm your email | SewIndie",
  robots: { index: false, follow: false },
}

const COPY: Record<VerifyResult, { title: string; body: string; cta: string; href: string }> = {
  verified: {
    title: "Your email is confirmed",
    body: "Thanks! Your account is ready. Log in to start saving favorites and building collections.",
    cta: "Log in",
    href: "/login?message=Email confirmed. You can log in now.",
  },
  expired: {
    title: "This link has expired",
    body: "Confirmation links last 24 hours. Try logging in and we'll offer to send you a fresh one.",
    cta: "Go to login",
    href: "/login",
  },
  invalid: {
    title: "This link isn't valid",
    body: "It may have already been used. If your email is already confirmed, you can log in as usual.",
    cta: "Go to login",
    href: "/login",
  },
}

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const result = await consumeVerificationToken(token)
  const copy = COPY[result]

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-brand">SewIndie</span>
          <h1 className="auth-title text-balance">{copy.title}</h1>
          <p className="auth-subtitle text-pretty">{copy.body}</p>
        </div>
        <Link href={copy.href} className="auth-submit" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
          {copy.cta}
        </Link>
      </div>
    </main>
  )
}

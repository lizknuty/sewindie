'use client'

import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// Mirrors EMAIL_NOT_VERIFIED_ERROR in lib/email-verification (a server-only module).
const EMAIL_NOT_VERIFIED_ERROR = 'EMAIL_NOT_VERIFIED'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [resendMessage, setResendMessage] = useState('')
  const router = useRouter()

  const handleResend = async () => {
    setResendStatus('sending')
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      setResendMessage(data.message || 'Request sent.')
    } catch {
      setResendMessage('Something went wrong. Please try again.')
    } finally {
      setResendStatus('sent')
    }
  }
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  // create-account redirects here with ?message=... on success; surfacing it
  // closes the loop so a new user knows the account was made before they log in.
  const notice = searchParams.get('message')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      })

      if (result?.error === EMAIL_NOT_VERIFIED_ERROR) {
        setNeedsVerification(true)
        setError('Please confirm your email before logging in. Check your inbox for the link we sent.')
      } else if (result?.error) {
        setError('Invalid email or password')
      } else {
        router.push(callbackUrl)
      }
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-brand">SewIndie</span>
          <h1 className="auth-title text-balance">Welcome back</h1>
          <p className="auth-subtitle text-pretty">
            Log in to reach your favorites, collections, and account.
          </p>
        </div>

        {notice && (
          <p className="auth-notice" role="status">
            {notice}
          </p>
        )}

        <form onSubmit={handleSubmit} suppressHydrationWarning>
          <div className="auth-field" suppressHydrationWarning>
            <label htmlFor="email" className="auth-label">
              Email address
            </label>
            <input
              type="email"
              className="auth-input"
              id="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-field" suppressHydrationWarning>
            <div className="auth-label-row">
              <label htmlFor="password" className="auth-label">
                Password
              </label>
              <Link href="/forgot-password" className="auth-link auth-forgot">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              className="auth-input"
              id="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          {needsVerification && (
            <div className="auth-field">
              {resendStatus === 'sent' ? (
                <p className="auth-notice" role="status">
                  {resendMessage}
                </p>
              ) : (
                <button
                  type="button"
                  className="auth-link"
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                  onClick={handleResend}
                  disabled={resendStatus === 'sending'}
                >
                  {resendStatus === 'sending' ? 'Sending\u2026' : 'Resend confirmation email'}
                </button>
              )}
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in\u2026' : 'Log in'}
          </button>
        </form>

        <p className="auth-alt">
          Don&apos;t have an account?{' '}
          <Link href="/create-account" className="auth-link">
            Create one here
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-shell">
          <div className="auth-card auth-card-loading">Loading&#8230;</div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}

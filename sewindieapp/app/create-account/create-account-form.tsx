'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'

const TURNSTILE_SIGNUP_ACTION = 'signup'

export default function CreateAccountForm({ formToken }: { formToken: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [website, setWebsite] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    const turnstileResponse = (window as any).turnstile?.getResponse()

    if (!turnstileResponse) {
      setError('Please complete the security check.')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          password,
          website,
          formToken,
          turnstileToken: turnstileResponse,
        }),
      })

      if (response.ok) {
        const message = `Almost done! We sent a confirmation link to ${email}. Click it to activate your account, then log in.`
        router.push(`/login?message=${encodeURIComponent(message)}`)
      } else {
        const data = await response.json()
        setError(data.message || 'An error occurred. Please try again.')
        ;(window as any).turnstile?.reset()
      }
    } catch {
      setError('An error occurred. Please try again.')
      ;(window as any).turnstile?.reset()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      <main className="auth-shell">
        <div className="auth-card">
          <div className="auth-head">
            <span className="auth-brand">SewIndie</span>
            <h1 className="auth-title text-balance">Create your account</h1>
            <p className="auth-subtitle text-pretty">
              Join to save favorites, build collections, and follow indie designers.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="name" className="auth-label">
                Name
              </label>
              <input
                type="text"
                className="auth-input"
                id="name"
                autoComplete="name"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="email" className="auth-label">
                Email address
              </label>
              <input
                type="email"
                className="auth-input"
                id="email"
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="auth-label">
                Password
              </label>
              <input
                type="password"
                className="auth-input"
                id="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                aria-describedby="passwordHelp"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <span id="passwordHelp" className="account-help">
                At least 10 characters. A short phrase of a few words works well.
              </span>
            </div>

            {/* Honeypot: hidden from people and assistive tech; bots that fill every field reveal themselves. */}
            <div
              aria-hidden="true"
              style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
            >
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div className="auth-field">
              <div
                className="cf-turnstile"
                data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                data-action={TURNSTILE_SIGNUP_ACTION}
                data-theme="light"
              />
            </div>

            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account\u2026' : 'Create account'}
            </button>
          </form>

          <p className="auth-alt">
            Already have an account?{' '}
            <Link href="/login" className="auth-link">
              Log in here
            </Link>
          </p>
        </div>
      </main>
    </>
  )
}

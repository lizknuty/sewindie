'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'

export default function CreateAccountPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
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
          turnstileToken: turnstileResponse,
        }),
      })

      if (response.ok) {
        router.push('/login?message=Account created successfully. Please log in.')
      } else {
        const data = await response.json()
        setError(data.message || 'An error occurred. Please try again.')
        ;(window as any).turnstile?.reset()
      }
    } catch (error) {
      setError('An error occurred. Please try again.')
      ;(window as any).turnstile?.reset()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
      />
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <div
                ref={turnstileRef}
                className="cf-turnstile"
                data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
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

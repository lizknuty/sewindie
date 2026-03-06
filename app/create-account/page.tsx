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
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    // Get the Turnstile token
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
          turnstileToken: turnstileResponse 
        }),
      })

      if (response.ok) {
        router.push('/login?message=Account created successfully. Please log in.')
      } else {
        const data = await response.json()
        setError(data.message || 'An error occurred. Please try again.')
        // Reset Turnstile on error
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
        onLoad={() => setTurnstileLoaded(true)}
      />
      <div className="container mt-5">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <h2 className="mb-4">Create Account</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="name" className="form-label">Name</label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="email" className="form-label">Email address</label>
                <input
                  type="email"
                  className="form-control"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="password" className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              
              {/* Cloudflare Turnstile Widget */}
              <div className="mb-3">
                <div
                  ref={turnstileRef}
                  className="cf-turnstile"
                  data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                  data-theme="light"
                />
              </div>

              {error && <div className="alert alert-danger">{error}</div>}
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
            <p className="mt-3">
              Already have an account? <Link href="/login">Login here</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

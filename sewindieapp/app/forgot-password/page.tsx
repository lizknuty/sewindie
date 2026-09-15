"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import Script from "next/script"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    const turnstileToken = (window as any).turnstile?.getResponse()

    if (!turnstileToken) {
      setMessage({ text: "Please complete the security check.", type: "error" })
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, turnstileToken }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({
          text: "If an account with that email exists, we've sent a password reset link.",
          type: "success",
        })
        setEmail("")
        ;(window as any).turnstile?.reset()
      } else {
        setMessage({
          text: data.error || "Something went wrong. Please try again.",
          type: "error",
        })
        ;(window as any).turnstile?.reset()
      }
    } catch (error) {
      setMessage({
        text: "An unexpected error occurred. Please try again.",
        type: "error",
      })
      ;(window as any).turnstile?.reset()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-brand">SewIndie</span>
          <h1 className="auth-title text-balance">Reset your password</h1>
          <p className="auth-subtitle text-pretty">
            Enter your email and we&apos;ll send you a link to set a new password.
          </p>
        </div>

        {message && (
          <p
            className={message.type === "success" ? "auth-notice" : "auth-error"}
            role={message.type === "success" ? "status" : "alert"}
          >
            {message.text}
          </p>
        )}

        <form onSubmit={handleSubmit}>
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
              disabled={isSubmitting}
            />
          </div>

          <div className="auth-field">
            <div
              className="cf-turnstile"
              data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              data-theme="light"
            />
          </div>

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending\u2026" : "Send reset link"}
          </button>
        </form>

        <p className="auth-alt">
          <Link href="/login" className="auth-link">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  )
}

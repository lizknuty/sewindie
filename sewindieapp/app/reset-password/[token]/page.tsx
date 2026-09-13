"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null)
  const router = useRouter()

  const params = useParams<{ token: string }>()
  const token = params.token

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/auth/verify-reset-token?token=${token}`)
        const data = await response.json()

        setIsTokenValid(response.ok)

        if (!response.ok) {
          setMessage({
            text: data.error || "Invalid or expired reset link. Please request a new one.",
            type: "error",
          })
        }
      } catch (error) {
        setIsTokenValid(false)
        setMessage({
          text: "An error occurred while verifying your reset link.",
          type: "error",
        })
      }
    }

    if (token) {
      verifyToken()
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      setMessage({
        text: "Passwords do not match.",
        type: "error",
      })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({
          text: "Password has been reset successfully! Redirecting to login\u2026",
          type: "success",
        })

        setTimeout(() => {
          router.push("/login")
        }, 2000)
      } else {
        setMessage({
          text: data.error || "Failed to reset password. Please try again.",
          type: "error",
        })
      }
    } catch (error) {
      setMessage({
        text: "An unexpected error occurred. Please try again.",
        type: "error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Verifying the token
  if (isTokenValid === null) {
    return (
      <main className="auth-shell">
        <div className="auth-card auth-card-loading">Verifying your reset link&#8230;</div>
      </main>
    )
  }

  // Invalid or expired token
  if (isTokenValid === false) {
    return (
      <main className="auth-shell">
        <div className="auth-card">
          <div className="auth-head">
            <span className="auth-brand">SewIndie</span>
            <h1 className="auth-title text-balance">Link expired</h1>
            <p className="auth-subtitle text-pretty">
              {message?.text || "This reset link is invalid or has expired."}
            </p>
          </div>
          <Link href="/forgot-password" className="auth-submit auth-submit-link">
            Request a new link
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="auth-head">
          <span className="auth-brand">SewIndie</span>
          <h1 className="auth-title text-balance">Set a new password</h1>
          <p className="auth-subtitle text-pretty">
            Choose a new password for your account.
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
            <label htmlFor="password" className="auth-label">
              New password
            </label>
            <input
              type="password"
              className="auth-input"
              id="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
              minLength={8}
            />
          </div>

          <div className="auth-field">
            <label htmlFor="confirmPassword" className="auth-label">
              Confirm password
            </label>
            <input
              type="password"
              className="auth-input"
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isSubmitting}
              minLength={8}
            />
          </div>

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? "Resetting\u2026" : "Reset password"}
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

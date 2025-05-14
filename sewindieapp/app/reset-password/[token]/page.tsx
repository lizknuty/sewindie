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

  // Use the useParams hook instead of accessing params directly
  const params = useParams<{ token: string }>()
  const token = params.token

  // Verify token on page load
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

    // Validate passwords match
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
          text: "Password has been reset successfully!",
          type: "success",
        })

        // Redirect to login after 2 seconds
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

  // Show loading state while verifying token
  if (isTokenValid === null) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3">Verifying your reset link...</p>
      </div>
    )
  }

  // Show error if token is invalid
  if (isTokenValid === false) {
    return (
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="card shadow">
              <div className="card-body p-4 text-center">
                <div className="alert alert-danger">{message?.text || "Invalid or expired reset link."}</div>
                <Link href="/forgot-password" className="btn btn-primary">
                  Request New Reset Link
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-4">
          <div className="card shadow">
            <div className="card-body p-4">
              <h2 className="text-center mb-4">Set New Password</h2>

              {message && (
                <div className={`alert ${message.type === "success" ? "alert-success" : "alert-danger"}`}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="password" className="form-label">
                    New Password
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                    minLength={8}
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="confirmPassword" className="form-label">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                    minLength={8}
                  />
                </div>

                <div className="d-grid gap-2">
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? "Resetting..." : "Reset Password"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

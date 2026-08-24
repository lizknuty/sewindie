"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setMessage({
        text: "New passwords do not match.",
        type: "error",
      })
      return
    }

    // Validate password length
    if (newPassword.length < 8) {
      setMessage({
        text: "Password must be at least 8 characters long.",
        type: "error",
      })
      return
    }

    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({
          text: "Password changed successfully!",
          type: "success",
        })

        // Clear form
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        setMessage({
          text: data.error || "Failed to change password.",
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

  return (
    <div>
      <header className="account-head">
        <h1 className="account-title">Change Password</h1>
        <p className="account-subtitle">Update the password you use to sign in to SewIndie.</p>
      </header>

      <section className="account-card">
        {message && (
          // role="status" so the result is announced to screen readers, which
          // otherwise get no feedback on a same-page submit.
          <div
            role="status"
            aria-live="polite"
            className={`account-alert ${
              message.type === "success" ? "account-alert-success" : "account-alert-error"
            }`}
          >
            {message.text}
          </div>
        )}

        <form className="account-form" onSubmit={handleSubmit}>
          <div className="account-field">
            <label htmlFor="currentPassword" className="account-label">
              Current password
            </label>
            <input
              type="password"
              className="account-input"
              id="currentPassword"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="account-field">
            <label htmlFor="newPassword" className="account-label">
              New password
            </label>
            <input
              type="password"
              className="account-input"
              id="newPassword"
              autoComplete="new-password"
              aria-describedby="newPasswordHelp"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={isSubmitting}
              minLength={8}
            />
            <span id="newPasswordHelp" className="account-help">
              Must be at least 8 characters long.
            </span>
          </div>

          <div className="account-field">
            <label htmlFor="confirmPassword" className="account-label">
              Confirm new password
            </label>
            <input
              type="password"
              className="account-input"
              id="confirmPassword"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isSubmitting}
              minLength={8}
            />
          </div>

          <button type="submit" className="account-btn" disabled={isSubmitting}>
            {isSubmitting ? "Changing password..." : "Change password"}
          </button>
        </form>
      </section>
    </div>
  )
}

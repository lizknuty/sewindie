"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const { token } = params
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isError, setIsError] = useState(false)
  const [isValidToken, setIsValidToken] = useState(false)
  const [loadingToken, setLoadingToken] = useState(true)

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setLoadingToken(false)
        setMessage("No reset token provided.")
        setIsError(true)
        return
      }
      try {
        const response = await fetch("/api/auth/verify-reset-token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        })
        if (response.ok) {
          setIsValidToken(true)
        } else {
          const data = await response.json()
          setMessage(data.error || "Invalid or expired password reset token.")
          setIsError(true)
        }
      } catch (error) {
        console.error("Token verification failed:", error)
        setMessage("Failed to verify token. Please try again later.")
        setIsError(true)
      } finally {
        setLoadingToken(false)
      }
    }
    verifyToken()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)
    setIsError(false)

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.")
      setIsError(true)
      setIsSubmitting(false)
      return
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters long.")
      setIsError(true)
      setIsSubmitting(false)
      return
    }

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
        setMessage(data.message)
        setPassword("")
        setConfirmPassword("")
        router.push("/login?resetSuccess=true") // Redirect to login with success message
      } else {
        setMessage(data.error || "An unexpected error occurred.")
        setIsError(true)
      }
    } catch (error) {
      console.error("Password reset failed:", error)
      setMessage("Failed to reset password. Please try again later.")
      setIsError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Verifying Token...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-500">Please wait while we verify your reset link.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isValidToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-12 sm:px-6 lg:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Invalid Link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-red-500">{message}</p>
            <div className="text-center text-sm mt-4">
              <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
                Request a new reset link
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 py-12 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>Enter your new password.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </Button>
            {message && (
              <p className={`text-center text-sm ${isError ? "text-red-500" : "text-green-600"}`}>{message}</p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

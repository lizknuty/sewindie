"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isError, setIsError] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)
    setIsError(false)

    if (newPassword !== confirmNewPassword) {
      setMessage("New passwords do not match.")
      setIsError(true)
      setIsSubmitting(false)
      return
    }

    if (newPassword.length < 6) {
      setMessage("New password must be at least 6 characters long.")
      setIsError(true)
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(data.message)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmNewPassword("")
        // Optionally redirect or show success message
        router.push("/my-account?passwordChanged=true")
      } else {
        setMessage(data.error || "An unexpected error occurred.")
        setIsError(true)
      }
    } catch (error) {
      console.error("Change password request failed:", error)
      setMessage("Failed to change password. Please try again later.")
      setIsError(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Change Password</h1>
      <Card className="max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Update Your Password</CardTitle>
          <CardDescription>Enter your current and new password to update.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Change Password"}
            </Button>
            {message && (
              <p className={`text-center text-sm ${isError ? "text-red-500" : "text-green-600"}`}>{message}</p>
            )}
            <div className="text-center text-sm">
              <Link href="/my-account" className="font-medium text-indigo-600 hover:text-indigo-500">
                Back to My Account
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

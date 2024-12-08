'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession, signOut } from 'next-auth/react'

export default function Navbar() {
  const { data: session } = useSession()

  useEffect(() => {
    // This will run on the client side and initialize Bootstrap's JavaScript
    require('bootstrap/dist/js/bootstrap.bundle.min.js')
  }, [])

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault()
    await signOut({ callbackUrl: '/' })
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark">
      <div className="container">
        <Link href="/" className="navbar-brand">
          <Image src="/logo.png" alt="SewIndie Logo" width={40} height={40} />
          <span>SewIndie</span>
        </Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ms-auto">
            <li className="nav-item">
              <Link href="/designers" className="nav-link">Designers</Link>
            </li>
            <li className="nav-item">
              <Link href="/patterns" className="nav-link">Patterns</Link>
            </li>
            <li className="nav-item">
              <Link href="/contribute" className="nav-link">Contribute</Link>
            </li>
            {session ? (
              <>
                <li className="nav-item">
                  <Link href="/my-account" className="nav-link">My Account</Link>
                </li>
                <li className="nav-item">
                  <a href="#" onClick={handleLogout} className="nav-link">Logout</a>
                </li>
              </>
            ) : (
              <li className="nav-item">
                <Link href="/login" className="nav-link">Login</Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </nav>
  )
}
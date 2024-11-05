import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Metadata } from 'next'
import './styles.css'

export const metadata: Metadata = {
  title: 'SewIndie',
  description: 'Explore and share sewing patterns',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="flex flex-col min-h-screen">
        <header>
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
                </ul>
              </div>
            </div>
          </nav>
        </header>
        {children}
        <footer className="footer text-center">
          <div className="container">
            <p>&copy; 2024 SewIndie App. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  )
}
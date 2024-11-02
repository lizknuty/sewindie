import React from 'react';
import Link from 'next/link'
import Image from 'next/image'
import 'bootstrap/dist/css/bootstrap.min.css'
import './styles.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <title>SewIndie</title>
        <meta name="description" content="Explore and share sewing patterns" />
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
          integrity="sha384-1BmE4kWBq78iYhFldvKuhfTAU6auU8tT94WrHftjDbrCEXSU1oBoqyl2QvZ6jIW3"
          crossOrigin="anonymous"
        />
      </head>
      <body>
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
        <main className="container my-4">
          {children}
        </main>
        <footer className="footer text-center">
          <div className="container">
            <p>&copy; 2024 SewIndie App. All rights reserved.</p>
          </div>
        </footer>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-ka7Sk0Gln4gmtz2MlQnikT1wXgYsOg+OMhuP+IlRH9sENBO0LRn5q+8nbTov4+1p" crossOrigin="anonymous"></script>
      </body>
    </html>
  )
}
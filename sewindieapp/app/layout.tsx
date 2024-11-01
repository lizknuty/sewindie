import React from 'react';
import Link from 'next/link'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <header className="bg-primary text-primary-foreground p-4">
          <nav className="container mx-auto flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold">Sewing Patterns</Link>
            <ul className="flex space-x-4">
              <li><Link href="/designers">Designers</Link></li>
              <li><Link href="/patterns">Patterns</Link></li>
              <li><Link href="/contribute">Contribute</Link></li>
            </ul>
          </nav>
        </header>
        <main className="container mx-auto p-4">
          {children}
        </main>
        <footer className="bg-muted text-muted-foreground p-4 mt-8">
          <div className="container mx-auto text-center">
            © 2024 SewIndie App
          </div>
        </footer>
      </body>
    </html>
  )
}
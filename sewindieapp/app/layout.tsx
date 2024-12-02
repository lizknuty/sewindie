import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Metadata } from 'next'
import { Open_Sans, Inter, Poiret_One } from 'next/font/google'
import './styles.css'
import Navbar from '@/components/Navbar'

const openSans = Open_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-open-sans',
})

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const poiretOne = Poiret_One({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poiret',
})

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
    <html lang="en" className={`${openSans.variable} ${inter.variable} ${poiretOne.variable}`}>
      <body className="flex flex-col min-h-screen">
        <header>
          <Navbar />
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
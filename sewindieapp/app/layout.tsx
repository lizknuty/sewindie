import type React from "react"
import type { Metadata } from "next"
import { Open_Sans, Inter, Poiret_One, Playfair_Display } from "next/font/google"
import "bootstrap/dist/css/bootstrap.min.css"
import "./styles.css"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { Providers } from "@/providers"
import { Analytics } from "@vercel/analytics/next"

const openSans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-open-sans",
})

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
})

const poiretOne = Poiret_One({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-poiret",
})

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  variable: "--font-playfair",
})

export const metadata: Metadata = {
  title: "SewIndie",
  description: "Explore and share sewing patterns",
  icons: {
    icon: "/favicon.ico",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} ${inter.variable} ${poiretOne.variable} ${playfairDisplay.variable}`}
    >
      <body className="flex flex-col min-h-screen">
        <Providers>
          <header>
            <Navbar />
          </header>
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}

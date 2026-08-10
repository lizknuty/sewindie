import Link from "next/link"

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-brand">
            <span className="footer-brand-name">SewIndie</span>
            <p className="footer-tagline">Explore and share indie sewing patterns.</p>
          </div>
          <nav className="footer-links" aria-label="Footer navigation">
            <Link href="/about" className="footer-link">
              About 
            </Link>
            <Link href="/about/privacy" className="footer-link">
              Privacy Policy 
            </Link>
            <Link href="/about/terms" className="footer-link">
              Terms of Service 
            </Link>
            <Link href="/about/dmca" className="footer-link">
              DMCA
            </Link>
          </nav>
        </div>
        <div className="footer-bottom">
          <p className="mb-0">&copy; {new Date().getFullYear()} SewIndie App. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

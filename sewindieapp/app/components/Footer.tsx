import Link from "next/link"
import { FacebookIcon, InstagramIcon, PinterestIcon, YoutubeIcon } from "./SocialIcons"

/**
 * Every route below was verified to exist in app/ before being linked, so the
 * footer contains no dead links.
 */
const LINK_GROUPS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Explore",
    links: [
      { href: "/patterns", label: "Patterns" },
      { href: "/designers", label: "Designers" },
      { href: "/fabric", label: "Fabric" },
      { href: "/resources", label: "Resources" },
    ],
  },
  {
    heading: "Community",
    links: [{ href: "/blog", label: "Blog" }],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "About Us" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Help",
    links: [
      { href: "/about/guidelines", label: "Guidelines" },
      { href: "/about/privacy", label: "Privacy Policy" },
      { href: "/about/terms", label: "Terms of Use" },
      { href: "/about/dmca", label: "DMCA" },
    ],
  },
]

// TODO: swap the YouTube and Pinterest `href`s once those accounts exist.
const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com/sewindie", Icon: InstagramIcon },
  { label: "Pinterest", href: null, Icon: PinterestIcon },
  { label: "Facebook", href: "https://facebook.com/sewindieapp", Icon: FacebookIcon },
  { label: "YouTube", href: null, Icon: YoutubeIcon },
]

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <div className="site-footer-top">
          <div className="site-footer-brand">
            <span className="site-footer-brand-name">SewIndie</span>
            <p className="site-footer-tagline">A community cataloging indie sewing patterns.</p>
          </div>

          <div className="site-footer-groups">
            {LINK_GROUPS.map((group) => (
              <nav className="site-footer-group" key={group.heading} aria-labelledby={`footer-${group.heading}`}>
                <h2 className="site-footer-heading" id={`footer-${group.heading}`}>
                  {group.heading}
                </h2>
                <ul className="site-footer-list">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="site-footer-link">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <div className="site-footer-group">
              <h2 className="site-footer-heading" id="footer-social">
                Follow Us
              </h2>
              <ul className="site-footer-socials" aria-labelledby="footer-social">
                {SOCIALS.map(({ label, href, Icon }) => (
                  <li key={label}>
                    {/* Accounts without a URL yet render as a disabled control
                        rather than a href="#" anchor, which would look like a
                        link but navigate nowhere for keyboard/screen-reader
                        users. */}
                    {href ? (
                      <a
                        href={href}
                        className="site-footer-social"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`SewIndie on ${label} (opens in a new tab)`}
                      >
                        <Icon />
                      </a>
                    ) : (
                      <span
                        className="site-footer-social is-pending"
                        role="img"
                        aria-label={`${label} — coming soon`}
                      >
                        <Icon />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="site-footer-bottom">
          <p>&copy; {new Date().getFullYear()} SewIndie LLC. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

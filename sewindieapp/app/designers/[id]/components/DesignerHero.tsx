import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ExternalLink } from "lucide-react"
import { FacebookIcon, InstagramIcon, PinterestIcon, YoutubeIcon } from "@/components/SocialIcons"

type DesignerHeroProps = {
  name: string
  tagline: string | null
  logo_url: string | null
  url: string
  facebook: string | null
  instagram: string | null
  pinterest: string | null
  youtube: string | null
}

/**
 * Placeholder shown until a designer has real copy in the `tagline` column.
 * Deliberately generic so it reads sensibly for any designer.
 */
const TAGLINE_PLACEHOLDER =
  "Independent sewing patterns drafted for real bodies, with clear instructions and pieces you will make again and again."

export default function DesignerHero({
  name,
  tagline,
  logo_url,
  url,
  facebook,
  instagram,
  pinterest,
  youtube,
}: DesignerHeroProps) {
  // Built as a list so the markup collapses cleanly when a designer has only
  // one or two accounts, rather than leaving gaps in a fixed four-slot row.
  const socials = [
    { href: facebook, label: "Facebook", Icon: FacebookIcon },
    { href: pinterest, label: "Pinterest", Icon: PinterestIcon },
    { href: instagram, label: "Instagram", Icon: InstagramIcon },
    { href: youtube, label: "YouTube", Icon: YoutubeIcon },
  ].filter((s): s is { href: string; label: string; Icon: typeof FacebookIcon } => Boolean(s.href))

  return (
    <section className="dhero">
      <div className="dhero-shell">
        <Link href="/designers" className="dhero-back">
          <ChevronLeft size={16} aria-hidden="true" />
          Back to designers
        </Link>

        <div className="dhero-main">
          <div className="dhero-copy">
            <h1 className="dhero-name">{name}</h1>
            <p className="dhero-tagline">{tagline?.trim() || TAGLINE_PLACEHOLDER}</p>

            {socials.length > 0 && (
              <ul className="dhero-socials">
                {socials.map(({ href, label, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dhero-social"
                      aria-label={`${name} on ${label}`}
                    >
                      <Icon size={16} />
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <a href={url} target="_blank" rel="noopener noreferrer" className="dhero-shop">
              Visit Shop
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          </div>

          {logo_url && (
            <div className="dhero-logo">
              {/* Unoptimized: designer logos are arbitrary remote URLs, matching
                  how PatternThumbnail handles pattern images. */}
              <Image
                src={logo_url}
                alt={`${name} logo`}
                width={300}
                height={160}
                className="dhero-logo-img"
                unoptimized
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

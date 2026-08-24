import Link from "next/link"
import { Users } from "lucide-react"

export default function CommunityCallout() {
  return (
    <section className="home-community" aria-labelledby="home-community-title">
      <span className="home-community-icon" aria-hidden="true">
        <Users size={26} strokeWidth={1.75} />
      </span>

      <h2 id="home-community-title" className="home-community-title text-balance">
        More than a catalog. It&apos;s a community.
      </h2>

      <p className="home-community-copy text-pretty">
        Share makes, get tips, build your lists, and be inspired by sewists around the world.
      </p>

      <Link href="/create-account" className="home-btn home-btn-dark home-community-cta">
        Join the Community
      </Link>
    </section>
  )
}

import Image from "next/image"
import Link from "next/link"

/**
 * Homepage hero: copy on the left, the collage image on the right.
 *
 * The left panel's background is #fdede7 (--home-hero-bg) to match the blush
 * backdrop baked into hero.png, so the two halves read as one continuous band.
 */
export default function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-copy">
        <div className="home-hero-copy-inner">
          <h1 id="home-hero-title" className="home-hero-title text-balance">
            Discover. Track. Sew Your Style.
          </h1>
          <p className="home-hero-lede text-pretty">
            SewIndie is a social catalog of indie sewing patterns. Find patterns you love, track your makes, and connect
            with a community that gets it.
          </p>
          <div className="home-hero-actions">
            <Link href="/patterns" className="home-btn home-btn-dark">
              Browse Patterns
            </Link>
            <Link href="/designers" className="home-btn home-btn-light">
              Explore Designers
            </Link>
          </div>
        </div>
      </div>

      <div className="home-hero-media">
        {/* priority: this is the largest above-the-fold image, so preloading it
            keeps it from being the LCP bottleneck. */}
        <Image
          src="/hero.png"
          alt="A linen dress, wool trousers, and a sewist hand-stitching fabric on a dress form"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 50vw"
          className="home-hero-image"
        />
      </div>
    </section>
  )
}

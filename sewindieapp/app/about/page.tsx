import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "About | SewIndie",
  description:
    "Learn about SewIndie, a community-driven directory for discovering and sharing independent sewing patterns.",
}

export default function AboutPage() {
  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8">
          <h1 className="mb-4">About SewIndie</h1>

          <p className="lead">
            SewIndie is a community-driven directory built to help sewists discover, compare, and celebrate independent
            sewing pattern designers from around the world.
          </p>

          <p>
            Finding the perfect pattern can be overwhelming. Independent designers release beautiful, creative work
            across dozens of shops and platforms, but there has never been one place to browse it all. SewIndie brings
            these patterns together so you can search by garment type, fabric, difficulty, size range, and more, all in
            one spot.
          </p>

          <h2 className="h4 mt-5 mb-3">What you can do here</h2>
          <ul>
            <li>
              Browse a growing catalog of{" "}
              <Link href="/patterns">sewing patterns</Link> from independent designers.
            </li>
            <li>
              Explore <Link href="/designers">designer profiles</Link> to find makers whose style you love.
            </li>
            <li>Save your favorites and rate patterns you have sewn to help the community.</li>
            <li>
              <Link href="/contribute">Contribute</Link> new patterns and designers to keep the directory fresh.
            </li>
          </ul>

          <h2 className="h4 mt-5 mb-3">Supporting indie designers</h2>
          <p>
            Every pattern in our directory links back to the designer&apos;s own shop. We believe independent makers are
            the heart of the sewing community, and SewIndie exists to send them support, traffic, and appreciation.
          </p>

          <h2 className="h4 mt-5 mb-3">Get in touch</h2>
          <p>
            Have a question, a correction, or a designer you&apos;d like to see added? We&apos;d love to hear from you.
            You can start by <Link href="/contribute">contributing directly</Link> or reaching out through our contact
            channels.
          </p>

          <div className="mt-5 pt-3 border-top">
            <p className="mb-2">Read more about how SewIndie works:</p>
            <ul className="mb-0">
              <li>
                <Link href="/about/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/about/terms">Terms of Service</Link>
              </li>
              <li>
                <Link href="/about/dmca">DMCA Policy</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

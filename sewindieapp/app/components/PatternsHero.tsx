import React from "react"
import Image from "next/image"
import PatternSearch from "./PatternSearch"

export default function PatternsHero({ initialSearch }: { initialSearch: string }) {
  return (
    <section className="phero">
      <div className="phero-inner">
        <div className="phero-copy">
          <h1 className="phero-title text-balance">Find your next sewing project.</h1>
          <p className="phero-lede text-pretty">Search thousands of patterns from independent designers.</p>
          <PatternSearch initialSearch={initialSearch} />
        </div>

        {/* Decorative: the headline already conveys the message, so an alt
            description here would just repeat it for screen readers. */}
        <div className="phero-media">
          <Image
            src="/patterns-hero.png"
            alt=""
            fill
            className="phero-image"
            sizes="(min-width: 992px) 45vw, 100vw"
            priority
          />
        </div>
      </div>
    </section>
  )
}

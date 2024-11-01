import React from 'react';
import Link from 'next/link'

export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-bold">Welcome to Sewing Patterns</h1>
      <p className="text-xl">Discover and share sewing patterns from designers around the world.</p>
      <div className="flex space-x-4">
        <Link href="/designers" className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90">
          Browse Designers
        </Link>
        <Link href="/patterns" className="bg-secondary text-secondary-foreground px-4 py-2 rounded hover:bg-secondary/90">
          Explore Patterns
        </Link>
      </div>
    </div>
  )
}
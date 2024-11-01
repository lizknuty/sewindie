import Link from 'next/link'
import prisma from '@/lib/prisma'

export default async function Home() {
  const designerCount = await prisma.designer.count()
  const patternCount = await prisma.pattern.count()

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Welcome to Sewing Patterns App</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Link href="/designers" className="p-6 bg-blue-100 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-2xl font-semibold mb-2">Designers</h2>
          <p>Explore {designerCount} talented designers</p>
        </Link>
        <Link href="/patterns" className="p-6 bg-green-100 rounded-lg shadow-md hover:shadow-lg transition-shadow">
          <h2 className="text-2xl font-semibold mb-2">Patterns</h2>
          <p>Browse {patternCount} unique sewing patterns</p>
        </Link>
      </div>
      <div className="mt-8">
        <Link href="/contribute" className="inline-block px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors">
          Contribute a Pattern
        </Link>
      </div>
    </div>
  )
}
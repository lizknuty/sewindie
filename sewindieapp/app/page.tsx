import Link from 'next/link'
import prisma from '@/lib/prisma'

export default async function Home() {
  const designerCount = await prisma.designer.count()
  const patternCount = await prisma.pattern.count()

  return (
    <div className="row">
      <div className="col-12">
        <h1 className="text-center mb-5">Welcome to SewIndie</h1>
      </div>
      <div className="col-md-6 mb-4">
        <div className="card h-100">
          <div className="card-body">
            <h2 className="card-title">Designers</h2>
            <p className="card-text">Explore {designerCount} talented designers</p>
            <Link href="/designers" className="btn btn-primary">View Designers</Link>
          </div>
        </div>
      </div>
      <div className="col-md-6 mb-4">
        <div className="card h-100">
          <div className="card-body">
            <h2 className="card-title">Patterns</h2>
            <p className="card-text">Browse {patternCount} unique sewing patterns</p>
            <Link href="/patterns" className="btn btn-primary">View Patterns</Link>
          </div>
        </div>
      </div>
      <div className="col-12 text-center mt-4">
        <Link href="/contribute" className="btn btn-lg btn-primary">Contribute a Pattern</Link>
      </div>
    </div>
  )
}
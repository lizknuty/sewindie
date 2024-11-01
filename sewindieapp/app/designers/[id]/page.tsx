import { query } from '@/app/lib/db'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'

export async function generateStaticParams() {
  const designers = await query('SELECT id FROM designer')
  return designers.rows.map((designer) => ({
    id: designer.id.toString(),
  }))
}

export default async function DesignerPage({ params }: { params: { id: string } }) {
  try {
    const designer = await query('SELECT * FROM designer WHERE id = $1', [params.id])
    const patterns = await query('SELECT id, name, thumbnail_url FROM pattern WHERE designer_id = $1', [params.id])

    if (designer.rows.length === 0) {
      notFound()
    }

    const { name, url, logo_url, email, address, facebook, instagram, pinterest, youtube } = designer.rows[0]

    return (
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-4">{name}</h1>
        {logo_url && (
          <Image src={logo_url} alt={`${name} logo`} width={200} height={200} className="mb-4" />
        )}
        <div className="mb-4">
          <p>Email: {email}</p>
          <p>Address: {address}</p>
          <p>Website: <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{url}</a></p>
        </div>
        <div className="mb-4 flex space-x-4">
          {facebook && <a href={facebook} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Facebook</a>}
          {instagram && <a href={instagram} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Instagram</a>}
          {pinterest && <a href={pinterest} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Pinterest</a>}
          {youtube && <a href={youtube} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">YouTube</a>}
        </div>
        <h2 className="text-2xl font-bold mb-2">Patterns</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patterns.rows.map((pattern) => (
            <Link key={pattern.id} href={`/patterns/${pattern.id}`} className="block p-4 border rounded-lg hover:shadow-lg transition-shadow">
              {pattern.thumbnail_url && (
                <Image src={pattern.thumbnail_url} alt={`${pattern.name} thumbnail`} width={150} height={150} className="mx-auto mb-2" />
              )}
              <h3 className="text-lg font-semibold text-center">{pattern.name}</h3>
            </Link>
          ))}
        </div>
      </div>
    )
  } catch (error) {
    console.error('Database query error:', error)
    return <div>Error loading designer information. Please try again later.</div>
  }
}
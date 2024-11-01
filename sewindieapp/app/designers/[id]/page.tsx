import Link from 'next/link'
import prisma from '@/lib/prisma'

type Pattern = {
  id: number;
  name: string;
  thumbnail_url: string | null;
}

type Designer = {
  id: number;
  name: string;
  logo_url: string | null;
  url: string;
  email: string | null;
  address: string | null;
  facebook: string | null;
  instagram: string | null;
  pinterest: string | null;
  youtube: string | null;
  patterns: Pattern[];
}

export default async function DesignerPage({ params }: { params: { id: string } }) {
  const designer: Designer | null = await prisma.designer.findUnique({
    where: { id: parseInt(params.id) },
    include: {
      patterns: {
        select: { id: true, name: true, thumbnail_url: true }
      }
    }
  })

  if (!designer) {
    return <div className="container mx-auto px-4 py-8">Designer not found</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">{designer.name}</h1>
      {designer.logo_url && (
        <img src={designer.logo_url} alt={`${designer.name} logo`} className="w-48 h-48 object-contain mb-6" />
      )}
      <div className="mb-6">
        <p>Website: <a href={designer.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{designer.url}</a></p>
        {designer.email && <p>Email: {designer.email}</p>}
        {designer.address && <p>Address: {designer.address}</p>}
        {designer.facebook && <p>Facebook: <a href={designer.facebook} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{designer.facebook}</a></p>}
        {designer.instagram && <p>Instagram: <a href={designer.instagram} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{designer.instagram}</a></p>}
        {designer.pinterest && <p>Pinterest: <a href={designer.pinterest} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{designer.pinterest}</a></p>}
        {designer.youtube && <p>YouTube: <a href={designer.youtube} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{designer.youtube}</a></p>}
      </div>
      <h2 className="text-2xl font-semibold mb-4">Patterns</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {designer.patterns.map((pattern) => (
          <Link key={pattern.id} href={`/patterns/${pattern.id}`} className="block p-4 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            {pattern.thumbnail_url && (
              <img src={pattern.thumbnail_url} alt={pattern.name} className="w-full h-48 object-cover mb-4 rounded" />
            )}
            <h3 className="text-lg font-semibold text-center">{pattern.name}</h3>
          </Link>
        ))}
      </div>
    </div>
  )
}
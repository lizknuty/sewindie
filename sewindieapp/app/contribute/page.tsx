'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Designer {
  id: number;
  name: string;
}

export default function ContributeForm() {
  const [formData, setFormData] = useState({
    name: '',
    designer_id: '',
    url: '',
    thumbnail_url: '',
    yardage: '',
    sizes: '',
    language: '',
    audience: '',
    fabric_type: '',
  })
  const [designers, setDesigners] = useState<Designer[]>([])
  const router = useRouter()

  useEffect(() => {
    async function fetchDesigners() {
      const response = await fetch('/api/designers')
      if (response.ok) {
        const data = await response.json()
        setDesigners(data)
      } else {
        console.error('Failed to fetch designers')
      }
    }
    fetchDesigners()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const response = await fetch('/api/patterns', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    })
    if (response.ok) {
      router.push('/patterns')
    } else {
      alert('Error submitting pattern')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Contribute a Pattern</h1>
      <div>
        <label htmlFor="name" className="block mb-2">Pattern Name</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label htmlFor="designer_id" className="block mb-2">Designer</label>
        <select
          id="designer_id"
          name="designer_id"
          value={formData.designer_id}
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
        >
          <option value="">Select a designer</option>
          {designers.map((designer) => (
            <option key={designer.id} value={designer.id}>
              {designer.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="url" className="block mb-2">Pattern URL</label>
        <input
          type="url"
          id="url"
          name="url"
          value={formData.url}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label htmlFor="thumbnail_url" className="block mb-2">Thumbnail URL</label>
        <input
          type="url"
          id="thumbnail_url"
          name="thumbnail_url"
          value={formData.thumbnail_url}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label htmlFor="yardage" className="block mb-2">Yardage</label>
        <input
          type="number"
          id="yardage"
          name="yardage"
          value={formData.yardage}
          onChange={handleChange}
          step="0.1"
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label htmlFor="sizes" className="block mb-2">Sizes</label>
        <input
          type="text"
          id="sizes"
          name="sizes"
          value={formData.sizes}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label htmlFor="language" className="block mb-2">Language</label>
        <input
          type="text"
          id="language"
          name="language"
          value={formData.language}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label htmlFor="audience" className="block mb-2">Audience</label>
        <input
          type="text"
          id="audience"
          name="audience"
          value={formData.audience}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label  htmlFor="fabric_type" className="block mb-2">Fabric Type</label>
        <input
          type="text"
          id="fabric_type"
          name="fabric_type"
          value={formData.fabric_type}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
      </div>
      <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Submit Pattern
      </button>
    </form>
  )
}
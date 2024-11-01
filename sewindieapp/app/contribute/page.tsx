'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Designer, Category, Format, SuggestedFabric, Attribute } from '@/app/lib/db'

interface FormData {
  name: string;
  designer_id: string;
  url: string;
  thumbnail_url: string;
  yardage: string;
  sizes: string;
  language: string;
  audience: string;
  fabric_type: string;
  categories: string[];
  formats: string[];
  suggestedFabrics: string[];
  attributes: string[];
}

export default function ContributeForm() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    designer_id: '',
    url: '',
    thumbnail_url: '',
    yardage: '',
    sizes: '',
    language: '',
    audience: '',
    fabric_type: '',
    categories: [],
    formats: [],
    suggestedFabrics: [],
    attributes: [],
  })
  const [designers, setDesigners] = useState<Designer[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [formats, setFormats] = useState<Format[]>([])
  const [suggestedFabrics, setSuggestedFabrics] = useState<SuggestedFabric[]>([])
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      const designersResponse = await fetch('/api/designers')
      const categoriesResponse = await fetch('/api/categories')
      const formatsResponse = await fetch('/api/formats')
      const suggestedFabricsResponse = await fetch('/api/suggested-fabrics')
      const attributesResponse = await fetch('/api/attributes')

      if (designersResponse.ok) setDesigners(await designersResponse.json())
      if (categoriesResponse.ok) setCategories(await categoriesResponse.json())
      if (formatsResponse.ok) setFormats(await formatsResponse.json())
      if (suggestedFabricsResponse.ok) setSuggestedFabrics(await suggestedFabricsResponse.json())
      if (attributesResponse.ok) setAttributes(await attributesResponse.json())
    }
    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleMultiSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, options } = e.target
    const selectedValues = Array.from(options)
      .filter(option => option.selected)
      .map(option => option.value)
    setFormData(prev => ({ ...prev, [name]: selectedValues }))
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
            <option key={designer.id} value={designer.id.toString()}>
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
          required
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
          type="text"
          id="yardage"
          name="yardage"
          value={formData.yardage}
          onChange={handleChange}
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
        <label htmlFor="fabric_type" className="block mb-2">Fabric Type</label>
        <input
          type="text"
          id="fabric_type"
          name="fabric_type"
          value={formData.fabric_type}
          onChange={handleChange}
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label htmlFor="categories" className="block mb-2">Categories</label>
        <select
          id="categories"
          name="categories"
          multiple
          value={formData.categories}
          onChange={handleMultiSelect}
          className="w-full p-2 border rounded"
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id.toString()}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="formats" className="block mb-2">Formats</label>
        <select
          id="formats"
          name="formats"
          multiple
          value={formData.formats}
          onChange={handleMultiSelect}
          className="w-full p-2 border rounded"
        >
          {formats.map((format) => (
            <option key={format.id} value={format.id.toString()}>
              {format.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="suggestedFabrics" className="block mb-2">Suggested Fabrics</label>
        <select
          id="suggestedFabrics"
          name="suggestedFabrics"
          multiple
          value={formData.suggestedFabrics}
          onChange={handleMultiSelect}
          className="w-full p-2 border rounded"
        >
          {suggestedFabrics.map((fabric) => (
            <option key={fabric.id} value={fabric.id.toString()}>
              {fabric.name}
            </option>
          ))}
        </select>
      
      </div>
      <div>
        <label htmlFor="attributes" className="block mb-2">Attributes</label>
        <select
          id="attributes"
          name="attributes"
          multiple
          value={formData.attributes}
          onChange={handleMultiSelect}
          className="w-full p-2 border rounded"
        >
          {attributes.map((attribute) => (
            <option key={attribute.id} value={attribute.id.toString()}>
              {attribute.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Submit Pattern
      </button>
    </form>
  )
}
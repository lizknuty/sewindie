'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Define types for the form data and API responses
type Designer = {
  id: number;
  name: string;
}

type Category = {
  id: number;
  name: string;
}

type Format = {
  id: number;
  name: string;
}

type SuggestedFabric = {
  id: number;
  name: string;
}

type Attribute = {
  id: number;
  name: string;
}

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

export default function ContributePage() {
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      try {
        const [designersRes, categoriesRes, formatsRes, suggestedFabricsRes, attributesRes] = await Promise.all([
          fetch('/api/designers'),
          fetch('/api/categories'),
          fetch('/api/formats'),
          fetch('/api/suggested-fabrics'),
          fetch('/api/attributes')
        ])

        const [designersData, categoriesData, formatsData, suggestedFabricsData, attributesData] = await Promise.all([
          designersRes.json(),
          categoriesRes.json(),
          formatsRes.json(),
          suggestedFabricsRes.json(),
          attributesRes.json()
        ])

        setDesigners(designersData)
        setCategories(categoriesData)
        setFormats(formatsData)
        setSuggestedFabrics(suggestedFabricsData)
        setAttributes(attributesData)
      } catch (error) {
        console.error('Error fetching form data:', error)
        setError('Failed to load form data. Please try again later.')
      }
    }
    fetchData()
  }, [])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Failed to submit pattern')
      }

      const result = await response.json()
      router.push(`/patterns/${result.id}`)
    } catch (error) {
      console.error('Error submitting pattern:', error)
      setError('Failed to submit pattern. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Error</h1>
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Contribute a Pattern</h1>
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Pattern Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>

        <div>
          <label htmlFor="designer_id" className="block text-sm font-medium text-gray-700">Designer</label>
          <select
            id="designer_id"
            name="designer_id"
            value={formData.designer_id}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            <option value="">Select a designer</option>
            {designers.map(designer => (
              <option key={designer.id} value={designer.id.toString()}>{designer.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="url" className="block text-sm font-medium text-gray-700">Pattern URL</label>
          <input
            type="url"
            id="url"
            name="url"
            value={formData.url}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>

        <div>
          <label htmlFor="thumbnail_url" className="block text-sm font-medium text-gray-700">Thumbnail URL</label>
          <input
            type="url"
            id="thumbnail_url"
            name="thumbnail_url"
            value={formData.thumbnail_url}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>

        <div>
          <label htmlFor="yardage" className="block text-sm font-medium text-gray-700">Yardage</label>
          <input
            type="text"
            id="yardage"
            name="yardage"
            value={formData.yardage}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>

        <div>
          <label htmlFor="sizes" className="block text-sm font-medium text-gray-700">Sizes</label>
          <input
            type="text"
            id="sizes"
            name="sizes"
            value={formData.sizes}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>

        <div>
          <label htmlFor="language" className="block text-sm font-medium text-gray-700">Language</label>
          <input
            type="text"
            id="language"
            name="language"
            value={formData.language}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>

        <div>
          <label htmlFor="audience" className="block text-sm font-medium text-gray-700">Audience</label>
          <input
            type="text"
            id="audience"
            name="audience"
            value={formData.audience}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>

        <div>
          <label htmlFor="fabric_type" className="block text-sm font-medium text-gray-700">Fabric Type</label>
          <input
            type="text"
            id="fabric_type"
            name="fabric_type"
            value={formData.fabric_type}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          />
        </div>

        <div>
          <label htmlFor="categories" className="block text-sm font-medium text-gray-700">Categories</label>
          <select
            id="categories"
            name="categories"
            multiple
            value={formData.categories}
            onChange={handleMultiSelect}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            {categories.map(category => (
              <option key={category.id} value={category.id.toString()}>{category.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="formats" className="block text-sm font-medium text-gray-700">Formats</label>
          <select
            id="formats"
            name="formats"
            multiple
            value={formData.formats}
            onChange={handleMultiSelect}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            {formats.map(format => (
              <option key={format.id} value={format.id.toString()}>{format.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="suggestedFabrics" className="block text-sm font-medium text-gray-700">Suggested Fabrics</label>
          <select
            id="suggestedFabrics"
            name="suggestedFabrics"
            multiple
            value={formData.suggestedFabrics}
            onChange={handleMultiSelect}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            {suggestedFabrics.map(fabric => (
              <option key={fabric.id} value={fabric.id.toString()}>{fabric.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="attributes" className="block text-sm font-medium text-gray-700">Attributes</label>
          <select
            id="attributes"
            name="attributes"
            multiple
            value={formData.attributes}
            onChange={handleMultiSelect}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
          >
            {attributes.map(attribute => (
              <option key={attribute.id} value={attribute.id.toString()}>{attribute.name}</option>
            ))}
          </select>
        </div>

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Pattern'}
          </button>
        </div>
      </form>
    </div>
  )
}
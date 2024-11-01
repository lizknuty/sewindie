'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ContributeForm() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    designerId: '',
  })
  const router = useRouter()

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
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <label htmlFor="description" className="block mb-2">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
        />
      </div>
      <div>
        <label htmlFor="designerId" className="block mb-2">Designer</label>
        <select
          id="designerId"
          name="designerId"
          value={formData.designerId}
          onChange={handleChange}
          required
          className="w-full p-2 border rounded"
        >
          <option value="">Select a designer</option>
          {/* You would populate this list from your database */}
          <option value="1">Designer 1</option>
          <option value="2">Designer 2</option>
        </select>
      </div>
      <button type="submit" className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90">
        Submit Pattern
      </button>
    </form>
  )
}
"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"

// This interface now matches the full Designer model from your schema
interface Designer {
  id: number
  name: string
  url: string
  logo_url: string | null
  email: string | null
  address: string | null
  facebook: string | null
  instagram: string | null
  pinterest: string | null
  youtube: string | null
}

interface Category {
  id: number
  name: string
}

interface Audience {
  id: number
  name: string
}

interface FabricType {
  id: number
  name: string
}

interface SuggestedFabric {
  id: number
  name: string
}

interface Attribute {
  id: number
  name: string
}

interface Format {
  id: number
  name: string
}

interface PatternFormProps {
  pattern?: {
    id: number
    name: string
    designer_id: number
    designer?: Designer // Uses the updated Designer interface
    url: string
    thumbnail_url?: string | null
    yardage?: string | null
    sizes?: string | null
    language?: string | null
    difficulty?: string | null
    release_date?: Date | null
    PatternCategory?: Array<{
      category: Category
    }>
    PatternAudience?: Array<{
      audience: Audience
    }>
    PatternFabricType?: Array<{
      fabricType: FabricType
    }>
    PatternSuggestedFabric?: Array<{
      suggestedFabric: SuggestedFabric
    }>
    PatternAttribute?: Array<{
      attribute: Attribute
    }>
    PatternFormat?: Array<{
      Format: Format
    }>
  }
}

export default function PatternForm({ pattern }: PatternFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [designers, setDesigners] = useState<Designer[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [fabricTypes, setFabricTypes] = useState<FabricType[]>([])
  const [suggestedFabrics, setSuggestedFabrics] = useState<SuggestedFabric[]>([])
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [formats, setFormats] = useState<Format[]>([])

  const [formData, setFormData] = useState({
    name: pattern?.name || "",
    designer_id: pattern?.designer_id?.toString() || "",
    url: pattern?.url || "",
    thumbnail_url: pattern?.thumbnail_url || "",
    yardage: pattern?.yardage || "",
    sizes: pattern?.sizes || "",
    language: pattern?.language || "",
    difficulty: pattern?.difficulty || "",
    release_date: pattern?.release_date ? new Date(pattern.release_date) : null,
    categories: pattern?.PatternCategory?.map((pc) => pc.category.id.toString()) || [],
    audiences: pattern?.PatternAudience?.map((pa) => pa.audience.id.toString()) || [],
    fabricTypes: pattern?.PatternFabricType?.map((pf) => pf.fabricType.id.toString()) || [],
    suggestedFabrics: pattern?.PatternSuggestedFabric?.map((psf) => psf.suggestedFabric.id.toString()) || [],
    attributes: pattern?.PatternAttribute?.map((pa) => pa.attribute.id.toString()) || [],
    formats: pattern?.PatternFormat?.map((pf) => pf.Format.id.toString()) || [],
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          designersRes,
          categoriesRes,
          audiencesRes,
          fabricTypesRes,
          suggestedFabricsRes,
          attributesRes,
          formatsRes,
        ] = await Promise.all([
          fetch("/api/designers"),
          fetch("/api/categories"),
          fetch("/api/audiences"),
          fetch("/api/fabric-types"),
          fetch("/api/suggested-fabrics"),
          fetch("/api/attributes"),
          fetch("/api/formats"),
        ])

        if (
          !designersRes.ok ||
          !categoriesRes.ok ||
          !audiencesRes.ok ||
          !fabricTypesRes.ok ||
          !suggestedFabricsRes.ok ||
          !attributesRes.ok ||
          !formatsRes.ok
        ) {
          throw new Error("Failed to fetch form data")
        }

        const designersData = await designersRes.json()
        const categoriesData = await categoriesRes.json()
        const audiencesData = await audiencesRes.json()
        const fabricTypesData = await fabricTypesRes.json()
        const suggestedFabricsData = await suggestedFabricsRes.json()
        const attributesData = await attributesRes.json()
        const formatsData = await formatsRes.json()

        setDesigners(designersData)
        setCategories(categoriesData.categories || categoriesData || [])
        setAudiences(audiencesData.audiences || audiencesData || [])
        setFabricTypes(fabricTypesData.fabricTypes || fabricTypesData || [])
        setSuggestedFabrics(suggestedFabricsData.suggestedFabrics || suggestedFabricsData || [])
        setAttributes(attributesData.attributes || attributesData || [])
        setFormats(formatsData.formats || formatsData || [])
      } catch (error) {
        console.error("Error fetching form data:", error)
      }
    }

    fetchData()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleDateChange = (date: Date | null) => {
    setFormData((prev) => ({ ...prev, release_date: date }))
  }

  const handleMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>, fieldName: string) => {
    const options = Array.from(e.target.selectedOptions, (option) => option.value)
    setFormData((prev) => ({ ...prev, [fieldName]: options }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const url = pattern ? `/api/patterns/${pattern.id}` : "/api/patterns"
      const method = pattern ? "PUT" : "POST"

      const dataToSubmit = {
        ...formData,
        designer_id: Number.parseInt(formData.designer_id),
        difficulty: formData.difficulty || null,
        categories: formData.categories.map((id) => Number.parseInt(id)),
        audiences: formData.audiences.map((id) => Number.parseInt(id)),
        fabricTypes: formData.fabricTypes.map((id) => Number.parseInt(id)),
        suggestedFabrics: formData.suggestedFabrics.map((id) => Number.parseInt(id)),
        attributes: formData.attributes.map((id) => Number.parseInt(id)),
        formats: formData.formats.map((id) => Number.parseInt(id)),
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSubmit),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save pattern")
      }

      router.push("/admin/patterns")
      router.refresh()
    } catch (error) {
      console.error("Error saving pattern:", error)
      alert(`Failed to save pattern: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="name" className="form-label">
          Name *
        </label>
        <input
          type="text"
          className="form-control"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>

      <div className="mb-3">
        <label htmlFor="designer_id" className="form-label">
          Designer *
        </label>
        <select
          className="form-select"
          id="designer_id"
          name="designer_id"
          value={formData.designer_id}
          onChange={handleChange}
          required
        >
          <option value="">Select a designer</option>
          {designers.map((designer) => (
            <option key={designer.id} value={designer.id.toString()}>
              {designer.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3">
        <label htmlFor="url" className="form-label">
          Pattern URL *
        </label>
        <input
          type="url"
          className="form-control"
          id="url"
          name="url"
          value={formData.url}
          onChange={handleChange}
          required
        />
      </div>

      <div className="mb-3">
        <label htmlFor="thumbnail_url" className="form-label">
          Thumbnail URL
        </label>
        <input
          type="url"
          className="form-control"
          id="thumbnail_url"
          name="thumbnail_url"
          value={formData.thumbnail_url || ""}
          onChange={handleChange}
        />
        {formData.thumbnail_url && (
          <div className="mt-2">
            <Image
              src={formData.thumbnail_url || "/placeholder.svg"}
              alt="Thumbnail preview"
              width={100}
              height={100}
              className="rounded border"
            />
          </div>
        )}
      </div>

      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="categories" className="form-label">
            Categories
          </label>
          <select
            className="form-select"
            id="categories"
            name="categories"
            multiple
            value={formData.categories}
            onChange={(e) => handleMultiSelectChange(e, "categories")}
            size={5}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id.toString()}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-6 mb-3">
          <label htmlFor="audiences" className="form-label">
            Target Audiences
          </label>
          <select
            className="form-select"
            id="audiences"
            name="audiences"
            multiple
            value={formData.audiences}
            onChange={(e) => handleMultiSelectChange(e, "audiences")}
            size={5}
          >
            {audiences.map((audience) => (
              <option key={audience.id} value={audience.id.toString()}>
                {audience.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="fabricTypes" className="form-label">
            Fabric Types
          </label>
          <select
            className="form-select"
            id="fabricTypes"
            name="fabricTypes"
            multiple
            value={formData.fabricTypes}
            onChange={(e) => handleMultiSelectChange(e, "fabricTypes")}
            size={5}
          >
            {fabricTypes.map((fabricType) => (
              <option key={fabricType.id} value={fabricType.id.toString()}>
                {fabricType.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-6 mb-3">
          <label htmlFor="suggestedFabrics" className="form-label">
            Suggested Fabrics
          </label>
          <select
            className="form-select"
            id="suggestedFabrics"
            name="suggestedFabrics"
            multiple
            value={formData.suggestedFabrics}
            onChange={(e) => handleMultiSelectChange(e, "suggestedFabrics")}
            size={5}
          >
            {suggestedFabrics.map((suggestedFabric) => (
              <option key={suggestedFabric.id} value={suggestedFabric.id.toString()}>
                {suggestedFabric.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="attributes" className="form-label">
            Attributes
          </label>
          <select
            className="form-select"
            id="attributes"
            name="attributes"
            multiple
            value={formData.attributes}
            onChange={(e) => handleMultiSelectChange(e, "attributes")}
            size={5}
          >
            {attributes.map((attribute) => (
              <option key={attribute.id} value={attribute.id.toString()}>
                {attribute.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-6 mb-3">
          <label htmlFor="formats" className="form-label">
            Formats
          </label>
          <select
            className="form-select"
            id="formats"
            name="formats"
            multiple
            value={formData.formats}
            onChange={(e) => handleMultiSelectChange(e, "formats")}
            size={5}
          >
            {formats.map((format) => (
              <option key={format.id} value={format.id.toString()}>
                {format.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <div className="col-md-4 mb-3">
          <label htmlFor="sizes" className="form-label">
            Sizes
          </label>
          <input
            type="text"
            className="form-control"
            id="sizes"
            name="sizes"
            value={formData.sizes || ""}
            onChange={handleChange}
          />
        </div>

        <div className="col-md-4 mb-3">
          <label htmlFor="yardage" className="form-label">
            Yardage
          </label>
          <input
            type="text"
            className="form-control"
            id="yardage"
            name="yardage"
            value={formData.yardage || ""}
            onChange={handleChange}
          />
        </div>

        <div className="col-md-4 mb-3">
          <label htmlFor="language" className="form-label">
            Language
          </label>
          <input
            type="text"
            className="form-control"
            id="language"
            name="language"
            value={formData.language || ""}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="release_date" className="form-label">
            Release Date
          </label>
          <DatePicker
            selected={formData.release_date}
            onChange={handleDateChange}
            className="form-control"
            dateFormat="yyyy-MM-dd"
            isClearable
          />
        </div>

        <div className="col-md-6 mb-3">
          <label htmlFor="difficulty" className="form-label">
            Difficulty
          </label>
          <input
            type="text"
            className="form-control"
            id="difficulty"
            name="difficulty"
            value={formData.difficulty || ""}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Pattern"}
        </button>
        <Link href="/admin/patterns" className="btn btn-outline-secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}

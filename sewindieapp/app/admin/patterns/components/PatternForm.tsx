"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"

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

interface SizeChart {
  id: number
  label: string
  designer_id: number
  Designer: {
    name: string
  }
}

interface PatternFormProps {
  pattern?: {
    id: number
    name: string
    designer_id: number
    designer?: Designer
    url: string
    thumbnail_url?: string | null
    yardage?: string | null
    sizes?: string | null // This remains optional in the type, but the input field is removed
    language?: string | null
    difficulty?: string | null
    release_date?: Date | null
    status?: "PUBLISHED" | "IN_TESTING" | "DISCONTINUED" | null
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
    // Only the id is read here, to seed the selected chart ids. The selectable
    // options come from /api/size-charts instead.
    PatternSizeChart?: Array<{
      SizeChart: { id: number }
    }>
  }
}

export default function PatternForm({ pattern }: PatternFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Seeded with the pattern's own designer so a matching <option> exists on the
  // very first render. The full list arrives async, and a controlled <select>
  // whose value has no matching option gets silently reset to "" by the DOM,
  // which used to blank out the designer on every edit.
  const [designers, setDesigners] = useState<Designer[]>(pattern?.designer ? [pattern.designer] : [])
  const [categories, setCategories] = useState<Category[]>([])
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [fabricTypes, setFabricTypes] = useState<FabricType[]>([])
  const [suggestedFabrics, setSuggestedFabrics] = useState<SuggestedFabric[]>([])
  const [attributes, setAttributes] = useState<Attribute[]>([])
  const [formats, setFormats] = useState<Format[]>([])
  const [sizeCharts, setSizeCharts] = useState<SizeChart[]>([]) // New state for size charts

  const [formData, setFormData] = useState({
    name: pattern?.name || "",
    designer_id: pattern?.designer_id?.toString() || "",
    url: pattern?.url || "",
    thumbnail_url: pattern?.thumbnail_url || "",
    yardage: pattern?.yardage || "",
    // sizes: pattern?.sizes || "", // Removed from form data
    language: pattern?.language || "",
    difficulty: pattern?.difficulty || "",
    release_date: pattern?.release_date ? new Date(pattern.release_date) : null,
    status: pattern?.status || "PUBLISHED",
    categories: pattern?.PatternCategory?.map((pc) => pc.category.id.toString()) || [],
    audiences: pattern?.PatternAudience?.map((pa) => pa.audience.id.toString()) || [],
    fabricTypes: pattern?.PatternFabricType?.map((pf) => pf.fabricType.id.toString()) || [],
    suggestedFabrics: pattern?.PatternSuggestedFabric?.map((psf) => psf.suggestedFabric.id.toString()) || [],
    attributes: pattern?.PatternAttribute?.map((pa) => pa.attribute.id.toString()) || [],
    formats: pattern?.PatternFormat?.map((pf) => pf.Format.id.toString()) || [],
    sizeCharts: pattern?.PatternSizeChart?.map((psc) => psc.SizeChart.id.toString()) || [], // New field
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
          sizeChartsRes, // New fetch
        ] = await Promise.all([
          fetch("/api/designers"),
          fetch("/api/categories"),
          fetch("/api/audiences"),
          fetch("/api/fabric-types"),
          fetch("/api/suggested-fabrics"),
          fetch("/api/attributes"),
          fetch("/api/formats"),
          fetch("/api/size-charts"), // New fetch
        ])

        if (
          !designersRes.ok ||
          !categoriesRes.ok ||
          !audiencesRes.ok ||
          !fabricTypesRes.ok ||
          !suggestedFabricsRes.ok ||
          !attributesRes.ok ||
          !formatsRes.ok ||
          !sizeChartsRes.ok // Check new fetch
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
        const sizeChartsData = await sizeChartsRes.json() // Process new data

        setDesigners(designersData.designers || designersData || [])
        setCategories(categoriesData.categories || categoriesData || [])
        setAudiences(audiencesData.audiences || audiencesData || [])
        setFabricTypes(fabricTypesData.fabricTypes || fabricTypesData || [])
        setSuggestedFabrics(suggestedFabricsData.suggestedFabrics || suggestedFabricsData || [])
        setAttributes(attributesData.attributes || attributesData || [])
        setFormats(formatsData.formats || formatsData || [])
        setSizeCharts(sizeChartsData || []) // Set new state
      } catch (error) {
        console.error("Error fetching form data:", error)
      }
    }
    fetchData()
  }, [])

  // Size charts belong to a designer, so only the selected designer's charts are
  // valid for this pattern. Empty until a designer is chosen.
  const selectedDesignerId = formData.designer_id ? Number.parseInt(formData.designer_id) : null
  const availableSizeCharts = selectedDesignerId
    ? sizeCharts.filter((chart) => chart.designer_id === selectedDesignerId)
    : []

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target

    // Changing the designer invalidates any chart picked from the previous one.
    // Without this the stale ids stay in formData and get submitted even though
    // they are no longer visible in the list.
    if (name === "designer_id") {
      const nextDesignerId = value ? Number.parseInt(value) : null
      setFormData((prev) => ({
        ...prev,
        designer_id: value,
        sizeCharts: prev.sizeCharts.filter((id) => {
          const chart = sizeCharts.find((c) => c.id.toString() === id)
          return chart != null && chart.designer_id === nextDesignerId
        }),
      }))
      return
    }

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
        name: formData.name,
        designer_id: Number.parseInt(formData.designer_id),
        url: formData.url,
        thumbnail_url: formData.thumbnail_url,
        yardage: formData.yardage,
        // sizes: formData.sizes, // Removed from data to submit
        language: formData.language,
        difficulty: formData.difficulty,
        release_date: formData.release_date,
        status: formData.status,
        categories: formData.categories.map((id) => Number.parseInt(id)),
        audiences: formData.audiences.map((id) => Number.parseInt(id)),
        fabricTypes: formData.fabricTypes.map((id) => Number.parseInt(id)),
        suggestedFabrics: formData.suggestedFabrics.map((id) => Number.parseInt(id)),
        attributes: formData.attributes.map((id) => Number.parseInt(id)),
        formats: formData.formats.map((id) => Number.parseInt(id)),
        sizeCharts: formData.sizeCharts.map((id) => Number.parseInt(id)), // New field
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

  const selectedDesignerName = designers.find((d) => d.id === selectedDesignerId)?.name

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <section className="admin-form-card">
        <div className="admin-form-card-head">
          <h2 className="admin-form-card-title">Pattern Details</h2>
          <p className="admin-form-card-desc">
            The core information used to identify this pattern across the directory.
          </p>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field admin-field--full">
            <label htmlFor="name" className="admin-label">
              Name <span className="admin-label-req">*</span>
            </label>
            <input
              type="text"
              className="admin-input"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="admin-field">
            <label htmlFor="designer_id" className="admin-label">
              Designer <span className="admin-label-req">*</span>
            </label>
            <select
              className="admin-select"
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

          <div className="admin-field">
            <label htmlFor="status" className="admin-label">
              Status
            </label>
            <select className="admin-select" id="status" name="status" value={formData.status} onChange={handleChange}>
              <option value="PUBLISHED">Published</option>
              <option value="IN_TESTING">In Testing</option>
              <option value="DISCONTINUED">Discontinued</option>
            </select>
          </div>

          <div className="admin-field admin-field--full">
            <label htmlFor="url" className="admin-label">
              Pattern URL <span className="admin-label-req">*</span>
            </label>
            <input
              type="url"
              className="admin-input"
              id="url"
              name="url"
              value={formData.url}
              onChange={handleChange}
              required
            />
          </div>

          <div className="admin-field admin-field--full">
            <label htmlFor="thumbnail_url" className="admin-label">
              Thumbnail URL
            </label>
            <input
              type="url"
              className="admin-input"
              id="thumbnail_url"
              name="thumbnail_url"
              value={formData.thumbnail_url || ""}
              onChange={handleChange}
            />
            {formData.thumbnail_url && (
              <div className="admin-form-preview">
                <Image
                  src={formData.thumbnail_url || "/placeholder.svg"}
                  alt="Thumbnail preview"
                  width={88}
                  height={88}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="admin-form-card">
        <div className="admin-form-card-head">
          <h2 className="admin-form-card-title">Classification</h2>
          <p className="admin-form-card-desc">
            How this pattern is grouped and filtered. Hold Ctrl (Cmd on Mac) to select more than one in any list.
          </p>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field">
            <label htmlFor="categories" className="admin-label">
              Categories
            </label>
            <select
              className="admin-multiselect"
              id="categories"
              name="categories"
              multiple
              value={formData.categories}
              onChange={(e) => handleMultiSelectChange(e, "categories")}
              size={6}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id.toString()}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="audiences" className="admin-label">
              Target Audiences
            </label>
            <select
              className="admin-multiselect"
              id="audiences"
              name="audiences"
              multiple
              value={formData.audiences}
              onChange={(e) => handleMultiSelectChange(e, "audiences")}
              size={6}
            >
              {audiences.map((audience) => (
                <option key={audience.id} value={audience.id.toString()}>
                  {audience.name}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="fabricTypes" className="admin-label">
              Fabric Types
            </label>
            <select
              className="admin-multiselect"
              id="fabricTypes"
              name="fabricTypes"
              multiple
              value={formData.fabricTypes}
              onChange={(e) => handleMultiSelectChange(e, "fabricTypes")}
              size={6}
            >
              {fabricTypes.map((fabricType) => (
                <option key={fabricType.id} value={fabricType.id.toString()}>
                  {fabricType.name}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="suggestedFabrics" className="admin-label">
              Suggested Fabrics
            </label>
            <select
              className="admin-multiselect"
              id="suggestedFabrics"
              name="suggestedFabrics"
              multiple
              value={formData.suggestedFabrics}
              onChange={(e) => handleMultiSelectChange(e, "suggestedFabrics")}
              size={6}
            >
              {suggestedFabrics.map((suggestedFabric) => (
                <option key={suggestedFabric.id} value={suggestedFabric.id.toString()}>
                  {suggestedFabric.name}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="attributes" className="admin-label">
              Attributes
            </label>
            <select
              className="admin-multiselect"
              id="attributes"
              name="attributes"
              multiple
              value={formData.attributes}
              onChange={(e) => handleMultiSelectChange(e, "attributes")}
              size={6}
            >
              {attributes.map((attribute) => (
                <option key={attribute.id} value={attribute.id.toString()}>
                  {attribute.name}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="formats" className="admin-label">
              Formats
            </label>
            <select
              className="admin-multiselect"
              id="formats"
              name="formats"
              multiple
              value={formData.formats}
              onChange={(e) => handleMultiSelectChange(e, "formats")}
              size={6}
            >
              {formats.map((format) => (
                <option key={format.id} value={format.id.toString()}>
                  {format.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="admin-form-card">
        <div className="admin-form-card-head">
          <h2 className="admin-form-card-title">Size Charts</h2>
          <p className="admin-form-card-desc">
            Size charts belong to a designer, so only the charts owned by this pattern&apos;s designer can be attached.
          </p>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field admin-field--full">
            <label htmlFor="sizeCharts" className="admin-label">
              Applicable Size Charts
            </label>
            <select
              className="admin-multiselect"
              id="sizeCharts"
              name="sizeCharts"
              multiple
              value={formData.sizeCharts}
              onChange={(e) => handleMultiSelectChange(e, "sizeCharts")}
              size={5}
              disabled={!selectedDesignerId}
            >
              {availableSizeCharts.map((chart) => (
                <option key={chart.id} value={chart.id.toString()}>
                  {chart.label}
                </option>
              ))}
            </select>
            <p className="admin-hint">
              {!selectedDesignerId
                ? "Select a designer to see their size charts."
                : availableSizeCharts.length === 0
                  ? `${selectedDesignerName ?? "This designer"} has no size charts yet.`
                  : `Showing the ${availableSizeCharts.length} chart${
                      availableSizeCharts.length === 1 ? "" : "s"
                    } belonging to ${selectedDesignerName ?? "this designer"}.`}
            </p>
          </div>
        </div>
      </section>

      <section className="admin-form-card">
        <div className="admin-form-card-head">
          <h2 className="admin-form-card-title">Specifications</h2>
          <p className="admin-form-card-desc">Optional details shown on the public pattern page.</p>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field">
            <label htmlFor="yardage" className="admin-label">
              Yardage
            </label>
            <input
              type="text"
              className="admin-input"
              id="yardage"
              name="yardage"
              value={formData.yardage || ""}
              onChange={handleChange}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="language" className="admin-label">
              Language
            </label>
            <input
              type="text"
              className="admin-input"
              id="language"
              name="language"
              value={formData.language || ""}
              onChange={handleChange}
            />
          </div>

          <div className="admin-field">
            <label htmlFor="release_date" className="admin-label">
              Release Date
            </label>
            <DatePicker
              id="release_date"
              selected={formData.release_date}
              onChange={handleDateChange}
              className="admin-input"
              dateFormat="yyyy-MM-dd"
              placeholderText="yyyy-mm-dd"
              isClearable
            />
          </div>

          <div className="admin-field">
            <label htmlFor="difficulty" className="admin-label">
              Difficulty
            </label>
            <input
              type="text"
              className="admin-input"
              id="difficulty"
              name="difficulty"
              value={formData.difficulty || ""}
              onChange={handleChange}
            />
          </div>
        </div>
      </section>

      <div className="admin-form-actions">
        <button type="submit" className="admin-form-btn admin-form-btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : pattern ? "Save Pattern" : "Create Pattern"}
        </button>
        <Link href="/admin/patterns" className="admin-form-btn">
          Cancel
        </Link>
      </div>
    </form>
  )
}

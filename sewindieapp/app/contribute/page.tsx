"use client"

import type React from "react"

import { useState, useEffect } from "react"
import DatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { ChevronLeft, ChevronRight } from "lucide-react"

// Define types for the form data and API responses
type Designer = {
  id: number
  name: string
}

type Category = {
  id: number
  name: string
}

type Audience = {
  id: number
  name: string
}

interface FormData {
  name: string
  designer_id: string
  new_designer_name: string
  categories: string[]
  audience_id: string
  publication_date: Date | null
  publication_date_unknown: boolean
  published_in_print: boolean
  published_online: boolean
  pattern_url: string
  is_free: boolean
  is_bundle: boolean
  price: string
  is_knit: boolean
  is_woven: boolean
  suggested_fabrics: string
  required_notions: string
  total_yardage: string
}

const initialFormData: FormData = {
  name: "",
  designer_id: "",
  new_designer_name: "",
  categories: [],
  audience_id: "",
  publication_date: null,
  publication_date_unknown: false,
  published_in_print: false,
  published_online: false,
  pattern_url: "",
  is_free: false,
  is_bundle: false,
  price: "",
  is_knit: false,
  is_woven: false,
  suggested_fabrics: "",
  required_notions: "",
  total_yardage: "",
}

const steps = [
  "Name & Designer",
  "Category",
  "Audience", // Changed from 'Sizes & Audience'
  "Sources",
  "Links & Price",
  "Fabric & Notions",
]

export default function ContributePage() {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [designers, setDesigners] = useState<Designer[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [designersRes, categoriesRes, audiencesRes] = await Promise.all([
          fetch("/api/designers"),
          fetch("/api/categories"),
          fetch("/api/audiences"),
        ])

        const [designersData, categoriesData, audiencesData] = await Promise.all([
          designersRes.json(),
          categoriesRes.json(),
          audiencesRes.json(),
        ])

        setDesigners(designersData)
        setCategories(categoriesData)
        setAudiences(audiencesData)
      } catch (error) {
        console.error("Error fetching form data:", error)
        setError("Failed to load form data. Please try again later.")
      }
    }
    fetchData()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  const handleMultiSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, options } = e.target
    const selectedValues = Array.from(options)
      .filter((option) => option.selected)
      .map((option) => option.value)
    setFormData((prev) => ({ ...prev, [name]: selectedValues }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setSubmissionStatus(null)

    try {
      // Send data to the Google Sheets API route
      const sheetsResponse = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!sheetsResponse.ok) {
        throw new Error("Failed to submit to Google Sheets")
      }

      setSubmissionStatus("Pattern submitted successfully. Thank you for your contribution!")
      setFormData(initialFormData)
      setCurrentStep(0)
    } catch (error) {
      console.error("Error submitting pattern:", error)
      setError("Failed to submit pattern. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0))

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            <div className="mb-3">
              <label htmlFor="name" className="form-label">
                Pattern Name
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
                Designer
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
                <option value="not_listed">Not Listed</option>
                {designers.map((designer) => (
                  <option key={designer.id} value={designer.id.toString()}>
                    {designer.name}
                  </option>
                ))}
              </select>
            </div>
            {formData.designer_id === "not_listed" && (
              <div className="mb-3">
                <label htmlFor="new_designer_name" className="form-label">
                  New Designer Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  id="new_designer_name"
                  name="new_designer_name"
                  value={formData.new_designer_name}
                  onChange={handleChange}
                  required
                />
              </div>
            )}
          </div>
        )
      case 1:
        return (
          <div className="mb-3">
            <label htmlFor="categories" className="form-label">
              Categories
            </label>
            <select
              className="form-select"
              id="categories"
              name="categories"
              multiple
              value={formData.categories}
              onChange={handleMultiSelect}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id.toString()}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        )
      case 2: // This step is now just for Audience
        return (
          <div>
            <div className="mb-3">
              <label htmlFor="audience_id" className="form-label">
                Audience
              </label>
              <select
                className="form-select"
                id="audience_id"
                name="audience_id"
                value={formData.audience_id}
                onChange={handleChange}
              >
                <option value="">Select an audience</option>
                {audiences.map((audience) => (
                  <option key={audience.id} value={audience.id.toString()}>
                    {audience.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )
      case 3:
        return (
          <div>
            <div className="mb-3">
              <label className="form-label">When was this pattern first published?</label>
              <div className="input-group">
                <DatePicker
                  selected={formData.publication_date}
                  onChange={(date: Date | null) => setFormData((prev) => ({ ...prev, publication_date: date }))}
                  disabled={formData.publication_date_unknown}
                  className="form-control"
                />
                <div className="input-group-text">
                  <input
                    type="checkbox"
                    className="form-check-input mt-0"
                    name="publication_date_unknown"
                    checked={formData.publication_date_unknown}
                    onChange={handleChange}
                  />
                  <label className="form-check-label ms-2">Unknown</label>
                </div>
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">Where was this pattern published? Select all that apply</label>
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="published_in_print"
                  name="published_in_print"
                  checked={formData.published_in_print}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="published_in_print">
                  In Print (book, magazine, paper)
                </label>
              </div>
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="published_online"
                  name="published_online"
                  checked={formData.published_online}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="published_online">
                  On a blog or other website
                </label>
              </div>
            </div>
          </div>
        )
      case 4:
        return (
          <div>
            <div className="mb-3">
              <label htmlFor="pattern_url" className="form-label">
                Link to an outside webpage for this pattern
              </label>
              <input
                type="url"
                className="form-control"
                id="pattern_url"
                name="pattern_url"
                value={formData.pattern_url}
                onChange={handleChange}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Price</label>
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="is_free"
                  name="is_free"
                  checked={formData.is_free}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="is_free">
                  Free
                </label>
              </div>
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="is_bundle"
                  name="is_bundle"
                  checked={formData.is_bundle}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="is_bundle">
                  Part of a bundle
                </label>
              </div>
              <input
                type="text"
                className="form-control mt-2"
                name="price"
                value={formData.price}
                onChange={handleChange}
                disabled={formData.is_free}
                placeholder="Enter a price (example: 7.50)"
              />
            </div>
          </div>
        )
      case 5:
        return (
          <div>
            <div className="mb-3">
              <label className="form-label">Fabric Type</label>
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="is_knit"
                  name="is_knit"
                  checked={formData.is_knit}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="is_knit">
                  Knit
                </label>
              </div>
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="is_woven"
                  name="is_woven"
                  checked={formData.is_woven}
                  onChange={handleChange}
                />
                <label className="form-check-label" htmlFor="is_woven">
                  Woven
                </label>
              </div>
            </div>
            <div className="mb-3">
              <label htmlFor="suggested_fabrics" className="form-label">
                Suggested Fabrics
              </label>
              <textarea
                className="form-control"
                id="suggested_fabrics"
                name="suggested_fabrics"
                value={formData.suggested_fabrics}
                onChange={handleChange}
                rows={3}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="required_notions" className="form-label">
                Required Notions
              </label>
              <textarea
                className="form-control"
                id="required_notions"
                name="required_notions"
                value={formData.required_notions}
                onChange={handleChange}
                rows={3}
              />
            </div>
            <div className="mb-3">
              <label htmlFor="total_yardage" className="form-label">
                Total Yardage
              </label>
              <input
                type="text"
                className="form-control"
                id="total_yardage"
                name="total_yardage"
                value={formData.total_yardage}
                onChange={handleChange}
              />
            </div>
          </div>
        )
      default:
        return null
    }
  }

  if (error) {
    return (
      <div className="container mt-5">
        <h1 className="mb-4">Error</h1>
        <p className="text-danger">{error}</p>
      </div>
    )
  }

  return (
    <div className="container mt-5">
      <h1 className="mb-4">Contribute a Pattern</h1>
      <div className="row">
        <div className="col-md-3 mb-4">
          <div
            className="card"
            style={{
              border: "1px solid #dee2e6",
              borderRadius: "0.25rem",
              overflow: "hidden",
              backgroundColor: "white",
            }}
          >
            <div className="card-body" style={{ padding: "0" }}>
              <nav>
                <ul className="list-group">
                  {steps.map((step, index) => (
                    <li
                      key={step}
                      className={`list-group-item cursor-pointer`}
                      style={{
                        color: "black",
                        border: "none",
                        borderRadius: "0",
                        padding: "10px 15px",
                        borderLeft: index === currentStep ? "4px solid #fe7b83" : "none",
                        backgroundColor: index === currentStep ? "#fe7b83" : "white",
                      }}
                      onClick={() => setCurrentStep(index)}
                    >
                      {step}
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </div>
        <div className="col-md-9">
          <div className="card" style={{ backgroundColor: "white" }}>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                {renderStep()}
                <div className="d-flex justify-content-between mt-4">
                  {currentStep > 0 && (
                    <button type="button" onClick={prevStep} className="btn btn-outline-primary">
                      <ChevronLeft className="me-1" />
                      Back
                    </button>
                  )}
                  {currentStep < steps.length - 1 && (
                    <button type="button" onClick={nextStep} className="btn btn-rose ms-auto">
                      Next
                      <ChevronRight className="ms-1" />
                    </button>
                  )}
                  {currentStep === steps.length - 1 && (
                    <button type="submit" disabled={isSubmitting} className="btn btn-rose ms-auto">
                      {isSubmitting ? "Submitting..." : "Submit Pattern"}
                    </button>
                  )}
                </div>
              </form>
              {submissionStatus && (
                <div className="alert alert-success mt-4" role="alert">
                  {submissionStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

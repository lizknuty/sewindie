"use client"
import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, X } from "lucide-react"
import type { Decimal } from "@prisma/client/runtime/library" // Import Decimal type

interface Designer {
  id: number
  name: string
}

// This interface reflects the data structure as it comes directly from Prisma
interface PrismaSizeChartRow {
  id?: number // Optional for new rows
  size_label: string
  upper_bust_min: Decimal | null
  upper_bust_max: Decimal | null
  full_bust_min: Decimal | null
  full_bust_max: Decimal | null
  chest_min: Decimal | null
  chest_max: Decimal | null
  waist_min: Decimal | null
  waist_max: Decimal | null
  hip_min: Decimal | null
  hip_max: Decimal | null
  inseam_min: Decimal | null
  inseam_max: Decimal | null
  height_min: Decimal | null
  height_max: Decimal | null
}

// This interface reflects the data structure for the form's internal state (all measurements are strings)
interface FormSizeChartRowData {
  id?: number
  size_label: string
  upper_bust_min: string
  upper_bust_max: string
  full_bust_min: string
  full_bust_max: string
  chest_min: string
  chest_max: string
  waist_min: string
  waist_max: string
  hip_min: string
  hip_max: string
  inseam_min: string
  inseam_max: string
  height_min: string
  height_max: string
}

// New interface for serializable SizeChartRow (all measurements are strings)
interface SerializableSizeChartRow {
  id?: number
  size_label: string
  upper_bust_min: string | null
  upper_bust_max: string | null
  full_bust_min: string | null
  full_bust_max: string | null
  chest_min: string | null
  chest_max: string | null
  waist_min: string | null
  waist_max: string | null
  hip_min: string | null
  hip_max: string | null
  inseam_min: string | null
  inseam_max: string | null
  height_min: string | null
  height_max: string | null
}

interface SizeChartFormProps {
  sizeChart?: {
    id: number
    label: string
    designer_id: number
    measurement_unit: string
    SizeChartRow: SerializableSizeChartRow[] // Expect serializable types here
  }
  designers: Designer[]
}

export default function SizeChartForm({ sizeChart, designers }: SizeChartFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<{
    label: string
    designer_id: string
    measurement_unit: string
    rows: FormSizeChartRowData[] // Form data rows are strings
  }>({
    label: sizeChart?.label || "",
    designer_id: sizeChart?.designer_id?.toString() || "",
    measurement_unit: sizeChart?.measurement_unit || "inches",
    rows:
      sizeChart?.SizeChartRow.map((row) => ({
        id: row.id, // Ensure ID is carried over for existing rows
        size_label: row.size_label,
        upper_bust_min: row.upper_bust_min || "",
        upper_bust_max: row.upper_bust_max || "",
        full_bust_min: row.full_bust_min || "",
        full_bust_max: row.full_bust_max || "",
        chest_min: row.chest_min || "",
        chest_max: row.chest_max || "",
        waist_min: row.waist_min || "",
        waist_max: row.waist_max || "",
        hip_min: row.hip_min || "",
        hip_max: row.hip_max || "",
        inseam_min: row.inseam_min || "",
        inseam_max: row.inseam_max || "",
        height_min: row.height_min || "",
        height_max: row.height_max || "",
      })) || [],
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleRowChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const newRows = [...formData.rows]
    newRows[index] = { ...newRows[index], [name]: value }
    setFormData((prev) => ({ ...prev, rows: newRows }))
  }

  const addRow = () => {
    setFormData((prev) => ({
      ...prev,
      rows: [
        ...prev.rows,
        {
          size_label: "",
          upper_bust_min: "",
          upper_bust_max: "",
          full_bust_min: "",
          full_bust_max: "",
          chest_min: "",
          chest_max: "",
          waist_min: "",
          waist_max: "",
          hip_min: "",
          hip_max: "",
          inseam_min: "",
          inseam_max: "",
          height_min: "",
          height_max: "",
        },
      ],
    }))
  }

  const removeRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const url = sizeChart ? `/api/size-charts/${sizeChart.id}` : "/api/size-charts"
      const method = sizeChart ? "PUT" : "POST"
      const dataToSubmit = {
        ...formData,
        designer_id: Number.parseInt(formData.designer_id),
        // Filter out empty rows and ensure numeric fields are numbers or null
        rows: formData.rows
          .filter((row) => row.size_label.trim() !== "")
          .map((row) => ({
            ...row,
            upper_bust_min: row.upper_bust_min === "" ? null : Number(row.upper_bust_min),
            upper_bust_max: row.upper_bust_max === "" ? null : Number(row.upper_bust_max),
            full_bust_min: row.full_bust_min === "" ? null : Number(row.full_bust_min),
            full_bust_max: row.full_bust_max === "" ? null : Number(row.full_bust_max),
            chest_min: row.chest_min === "" ? null : Number(row.chest_min),
            chest_max: row.chest_max === "" ? null : Number(row.chest_max),
            waist_min: row.waist_min === "" ? null : Number(row.waist_min),
            waist_max: row.waist_max === "" ? null : Number(row.waist_max),
            hip_min: row.hip_min === "" ? null : Number(row.hip_min),
            hip_max: row.hip_max === "" ? null : Number(row.hip_max),
            inseam_min: row.inseam_min === "" ? null : Number(row.inseam_min),
            inseam_max: row.inseam_max === "" ? null : Number(row.inseam_max),
            height_min: row.height_min === "" ? null : Number(row.height_min),
            height_max: row.height_max === "" ? null : Number(row.height_max),
          })),
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
        throw new Error(errorData.error || "Failed to save size chart")
      }
      router.push("/admin/size-charts")
      router.refresh()
    } catch (error) {
      console.error("Error saving size chart:", error)
      alert(`Failed to save size chart: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="label" className="form-label">
          Label *
        </label>
        <input
          type="text"
          className="form-control"
          id="label"
          name="label"
          value={formData.label}
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
        <label htmlFor="measurement_unit" className="form-label">
          Measurement Unit *
        </label>
        <select
          className="form-select"
          id="measurement_unit"
          name="measurement_unit"
          value={formData.measurement_unit}
          onChange={handleChange}
          required
        >
          <option value="inches">Inches</option>
          <option value="cm">CM</option>
        </select>
      </div>
      <h3 className="mt-4 mb-3">Size Chart Rows</h3>
      <div className="table-responsive mb-3">
        <table className="table table-bordered table-sm">
          <thead>
            <tr>
              <th>Size Label *</th>
              <th colSpan={2}>Upper Bust</th>
              <th colSpan={2}>Full Bust</th>
              <th colSpan={2}>Chest</th>
              <th colSpan={2}>Waist</th>
              <th colSpan={2}>Hip</th>
              <th colSpan={2}>Inseam</th>
              <th colSpan={2}>Height</th>
              <th>Actions</th>
            </tr>
            <tr>
              <th></th>
              <th>Min</th>
              <th>Max</th>
              <th>Min</th>
              <th>Max</th>
              <th>Min</th>
              <th>Max</th>
              <th>Min</th>
              <th>Max</th>
              <th>Min</th>
              <th>Max</th>
              <th>Min</th>
              <th>Max</th>
              <th>Min</th>
              <th>Max</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {formData.rows.map((row, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="size_label"
                    value={row.size_label}
                    onChange={(e) => handleRowChange(index, e)}
                    required
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="upper_bust_min"
                    value={row.upper_bust_min}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="upper_bust_max"
                    value={row.upper_bust_max}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="full_bust_min"
                    value={row.full_bust_min}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="full_bust_max"
                    value={row.full_bust_max}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="chest_min"
                    value={row.chest_min}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="chest_max"
                    value={row.chest_max}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="waist_min"
                    value={row.waist_min}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="waist_max"
                    value={row.waist_max}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="hip_min"
                    value={row.hip_min}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="hip_max"
                    value={row.hip_max}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="inseam_min"
                    value={row.inseam_min}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="inseam_max"
                    value={row.inseam_max}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="height_min"
                    value={row.height_min}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.1"
                    className="form-control form-control-sm"
                    name="height_max"
                    value={row.height_max}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => removeRow(index)}>
                    <X size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn-outline-primary mb-4" onClick={addRow}>
        <Plus size={18} className="me-2" />
        Add Row
      </button>
      <div className="d-flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Size Chart"}
        </button>
        <Link href="/admin/size-charts" className="btn btn-outline-secondary">
          Cancel
        </Link>
      </div>
    </form>
  )
}

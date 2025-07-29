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
  under_bust_min: Decimal | null
  under_bust_max: Decimal | null
  waist_min: Decimal | null
  waist_max: Decimal | null
  preferred_waist_min: Decimal | null
  preferred_waist_max: Decimal | null
  side_waist_length_min: Decimal | null
  side_waist_length_max: Decimal | null
  waist_to_hip_length_min: Decimal | null
  waist_to_hip_length_max: Decimal | null
  high_hip_min: Decimal | null
  high_hip_max: Decimal | null
  hip_min: Decimal | null
  hip_max: Decimal | null
  thigh_min: Decimal | null
  thigh_max: Decimal | null
  calf_min: Decimal | null
  calf_max: Decimal | null
  inseam_min: Decimal | null
  inseam_max: Decimal | null
  crotch_length_min: Decimal | null
  crotch_length_max: Decimal | null
  arm_length_min: Decimal | null
  arm_length_max: Decimal | null
  upper_arm_min: Decimal | null
  upper_arm_max: Decimal | null
  height_min: Decimal | null
  height_max: Decimal | null
}

// This interface reflects the data structure for the form's internal state (all measurements are single strings)
interface FormSizeChartRowData {
  id?: number
  size_label: string
  upper_bust: string
  full_bust: string
  chest: string
  under_bust: string
  waist: string
  preferred_waist: string
  side_waist_length: string
  waist_to_hip_length: string
  high_hip: string
  hip: string
  thigh: string
  calf: string
  inseam: string
  crotch_length: string
  arm_length: string
  upper_arm: string
  height: string
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
  under_bust_min: string | null
  under_bust_max: string | null
  waist_min: string | null
  waist_max: string | null
  preferred_waist_min: string | null
  preferred_waist_max: string | null
  side_waist_length_min: string | null
  side_waist_length_max: string | null
  waist_to_hip_length_min: string | null
  waist_to_hip_length_max: string | null
  high_hip_min: string | null
  high_hip_max: string | null
  hip_min: string | null
  hip_max: string | null
  thigh_min: string | null
  thigh_max: string | null
  calf_min: string | null
  calf_max: string | null
  inseam_min: string | null
  inseam_max: string | null
  crotch_length_min: string | null
  crotch_length_max: string | null
  arm_length_min: string | null
  arm_length_max: string | null
  upper_arm_min: string | null
  upper_arm_max: string | null
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

// Helper function to parse a measurement input string into min/max numbers
const parseMeasurementInput = (input: string): { min: number | null; max: number | null } => {
  const trimmedInput = input.trim()
  if (trimmedInput === "") {
    return { min: null, max: null }
  }

  const parts = trimmedInput.split("-").map((p) => Number(p.trim()))

  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    // Case: "32-34" or "32.5-34.5"
    return { min: parts[0], max: parts[1] }
  } else if (parts.length === 1 && !isNaN(parts[0])) {
    // Case: "32" or "32.5" (single value, treat as max)
    return { min: null, max: parts[0] }
  } else {
    // Invalid format
    return { min: null, max: null }
  }
}

// Helper function to format min/max numbers into a single string for display
const formatMeasurementOutput = (min: string | null, max: string | null): string => {
  if (min !== null && max !== null) {
    return `${min}-${max}`
  }
  if (max !== null) {
    return max
  }
  if (min !== null) {
    return min // If only min is present, display it as a single value
  }
  return ""
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
        upper_bust: formatMeasurementOutput(row.upper_bust_min, row.upper_bust_max),
        full_bust: formatMeasurementOutput(row.full_bust_min, row.full_bust_max),
        chest: formatMeasurementOutput(row.chest_min, row.chest_max),
        under_bust: formatMeasurementOutput(row.under_bust_min, row.under_bust_max),
        waist: formatMeasurementOutput(row.waist_min, row.waist_max),
        preferred_waist: formatMeasurementOutput(row.preferred_waist_min, row.preferred_waist_max),
        side_waist_length: formatMeasurementOutput(row.side_waist_length_min, row.side_waist_length_max),
        waist_to_hip_length: formatMeasurementOutput(row.waist_to_hip_length_min, row.waist_to_hip_length_max),
        high_hip: formatMeasurementOutput(row.high_hip_min, row.high_hip_max),
        hip: formatMeasurementOutput(row.hip_min, row.hip_max),
        thigh: formatMeasurementOutput(row.thigh_min, row.thigh_max),
        calf: formatMeasurementOutput(row.calf_min, row.calf_max),
        inseam: formatMeasurementOutput(row.inseam_min, row.inseam_max),
        crotch_length: formatMeasurementOutput(row.crotch_length_min, row.crotch_length_max),
        arm_length: formatMeasurementOutput(row.arm_length_min, row.arm_length_max),
        upper_arm: formatMeasurementOutput(row.upper_arm_min, row.upper_arm_max),
        height: formatMeasurementOutput(row.height_min, row.height_max),
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
          upper_bust: "",
          full_bust: "",
          chest: "",
          under_bust: "",
          waist: "",
          preferred_waist: "",
          side_waist_length: "",
          waist_to_hip_length: "",
          high_hip: "",
          hip: "",
          thigh: "",
          calf: "",
          inseam: "",
          crotch_length: "",
          arm_length: "",
          upper_arm: "",
          height: "",
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
        rows: formData.rows
          .filter((row) => row.size_label.trim() !== "")
          .map((row) => {
            const upperBust = parseMeasurementInput(row.upper_bust)
            const fullBust = parseMeasurementInput(row.full_bust)
            const chest = parseMeasurementInput(row.chest)
            const underBust = parseMeasurementInput(row.under_bust)
            const waist = parseMeasurementInput(row.waist)
            const preferredWaist = parseMeasurementInput(row.preferred_waist)
            const sideWaistLength = parseMeasurementInput(row.side_waist_length)
            const waistToHipLength = parseMeasurementInput(row.waist_to_hip_length)
            const highHip = parseMeasurementInput(row.high_hip)
            const hip = parseMeasurementInput(row.hip)
            const thigh = parseMeasurementInput(row.thigh)
            const calf = parseMeasurementInput(row.calf)
            const inseam = parseMeasurementInput(row.inseam)
            const crotchLength = parseMeasurementInput(row.crotch_length)
            const armLength = parseMeasurementInput(row.arm_length)
            const upperArm = parseMeasurementInput(row.upper_arm)
            const height = parseMeasurementInput(row.height)

            return {
              id: row.id, // Ensure ID is carried over for existing rows
              size_label: row.size_label,
              upper_bust_min: upperBust.min,
              upper_bust_max: upperBust.max,
              full_bust_min: fullBust.min,
              full_bust_max: fullBust.max,
              chest_min: chest.min,
              chest_max: chest.max,
              under_bust_min: underBust.min,
              under_bust_max: underBust.max,
              waist_min: waist.min,
              waist_max: waist.max,
              preferred_waist_min: preferredWaist.min,
              preferred_waist_max: preferredWaist.max,
              side_waist_length_min: sideWaistLength.min,
              side_waist_length_max: sideWaistLength.max,
              waist_to_hip_length_min: waistToHipLength.min,
              waist_to_hip_length_max: waistToHipLength.max,
              high_hip_min: highHip.min,
              high_hip_max: highHip.max,
              hip_min: hip.min,
              hip_max: hip.max,
              thigh_min: thigh.min,
              thigh_max: thigh.max, // Fixed the typo here
              calf_min: calf.min,
              calf_max: calf.max,
              inseam_min: inseam.min,
              inseam_max: inseam.max,
              crotch_length_min: crotchLength.min,
              crotch_length_max: crotchLength.max,
              arm_length_min: armLength.min,
              arm_length_max: armLength.max,
              upper_arm_min: upperArm.min,
              upper_arm_max: upperArm.max,
              height_min: height.min,
              height_max: height.max,
            }
          }),
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

      <div className="alert alert-info mb-3">
        <strong>Input Format:</strong>
        <ul className="mb-0 mt-2">
          <li>Single value (e.g., "32") - will be saved as max value</li>
          <li>Range (e.g., "32-34") - will be saved as min-max range</li>
          <li>Leave empty for no measurement</li>
        </ul>
      </div>

      <h3 className="mt-4 mb-3">Size Chart Rows</h3>
      <div className="table-responsive mb-3">
        <table className="table table-bordered table-sm">
          <thead>
            <tr>
              <th>Size Label *</th>
              <th>Upper Bust</th>
              <th>Full Bust</th>
              <th>Chest</th>
              <th>Under Bust</th>
              <th>Waist</th>
              <th>Preferred Waist</th>
              <th>Side Waist Length</th>
              <th>Waist to Hip Length</th>
              <th>High Hip</th>
              <th>Hip</th>
              <th>Thigh</th>
              <th>Calf</th>
              <th>Inseam</th>
              <th>Crotch Length</th>
              <th>Arm Length</th>
              <th>Upper Arm</th>
              <th>Height</th>
              <th>Actions</th>
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
                    type="text"
                    className="form-control form-control-sm"
                    name="upper_bust"
                    value={row.upper_bust}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="full_bust"
                    value={row.full_bust}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="chest"
                    value={row.chest}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="under_bust"
                    value={row.under_bust}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="waist"
                    value={row.waist}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="preferred_waist"
                    value={row.preferred_waist}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="side_waist_length"
                    value={row.side_waist_length}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="waist_to_hip_length"
                    value={row.waist_to_hip_length}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="high_hip"
                    value={row.high_hip}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="hip"
                    value={row.hip}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="thigh"
                    value={row.thigh}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="calf"
                    value={row.calf}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="inseam"
                    value={row.inseam}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="crotch_length"
                    value={row.crotch_length}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="arm_length"
                    value={row.arm_length}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="upper_arm"
                    value={row.upper_arm}
                    onChange={(e) => handleRowChange(index, e)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    name="height"
                    value={row.height}
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

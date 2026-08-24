"use client"
import type React from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Check, Info, Plus, SlidersHorizontal, X } from "lucide-react"
// Prisma 7 removed the `@prisma/client/runtime/library` entry point; Decimal is
// now re-exported on the generated `Prisma` namespace.
import type { Prisma } from "@prisma/client"

type Decimal = Prisma.Decimal

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

// The measurement columns, driven from one list so the header row and the body
// cells cannot drift apart. Previously these were 17 hand-written <td> blocks,
// where a copy-paste slip would silently bind a cell to the wrong field.
type MeasurementKey = keyof Omit<FormSizeChartRowData, "id" | "size_label">

const MEASUREMENT_COLUMNS: { key: MeasurementKey; label: string }[] = [
  { key: "upper_bust", label: "Upper Bust" },
  { key: "full_bust", label: "Full Bust" },
  { key: "chest", label: "Chest" },
  { key: "under_bust", label: "Under Bust" },
  { key: "waist", label: "Waist" },
  { key: "preferred_waist", label: "Preferred Waist" },
  { key: "side_waist_length", label: "Side Waist Length" },
  { key: "waist_to_hip_length", label: "Waist to Hip Length" },
  { key: "high_hip", label: "High Hip" },
  { key: "hip", label: "Hip" },
  { key: "thigh", label: "Thigh" },
  { key: "calf", label: "Calf" },
  { key: "inseam", label: "Inseam" },
  { key: "crotch_length", label: "Crotch Length" },
  { key: "arm_length", label: "Arm Length" },
  { key: "upper_arm", label: "Upper Arm" },
  { key: "height", label: "Height" },
]

// Column visibility is remembered per browser. Only brand-new charts are seeded
// from it — an existing chart derives its own visible set from its content,
// which is more specific than a global preference.
const COLUMN_PREFS_KEY = "sewindie:size-chart-hidden-columns"

// Which measurements this saved chart actually uses. Every measurement follows
// the `<key>_min` / `<key>_max` column convention, so this can be derived
// straight from the DB row without going through the form's string formatting.
const usedColumnsFromChart = (rows: SerializableSizeChartRow[]): Set<MeasurementKey> => {
  const used = new Set<MeasurementKey>()
  for (const row of rows) {
    for (const col of MEASUREMENT_COLUMNS) {
      const record = row as unknown as Record<string, number | string | null | undefined>
      if (record[`${col.key}_min`] != null || record[`${col.key}_max`] != null) {
        used.add(col.key)
      }
    }
  }
  return used
}

// Which measurements currently have something typed in them.
const columnsWithData = (rows: FormSizeChartRowData[]): Set<MeasurementKey> => {
  const filled = new Set<MeasurementKey>()
  for (const row of rows) {
    for (const col of MEASUREMENT_COLUMNS) {
      if (row[col.key].trim() !== "") filled.add(col.key)
    }
  }
  return filled
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

  // Echoed in the format hint so the numbers being typed are unambiguous.
  const unitLabel = formData.measurement_unit === "cm" ? "centimetres" : "inches"

  // Derived from props only, so the server and first client render agree.
  // Stored preferences are applied later, in an effect, because localStorage
  // isn't available during SSR and reading it here would break hydration.
  const [hiddenCols, setHiddenCols] = useState<Set<MeasurementKey>>(() => {
    if (!sizeChart) return new Set()
    const used = usedColumnsFromChart(sizeChart.SizeChartRow)
    return new Set(MEASUREMENT_COLUMNS.filter((col) => !used.has(col.key)).map((col) => col.key))
  })
  const [colMenuOpen, setColMenuOpen] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  // Seed a new chart from the saved preference. Unknown keys are filtered out
  // so a renamed or removed measurement in a stale preference is ignored.
  useEffect(() => {
    if (sizeChart) return
    try {
      const raw = window.localStorage.getItem(COLUMN_PREFS_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as unknown
      if (!Array.isArray(stored)) return
      setHiddenCols(new Set(MEASUREMENT_COLUMNS.filter((col) => stored.includes(col.key)).map((col) => col.key)))
    } catch {
      // A corrupt or unavailable store just means "no preference".
    }
  }, [sizeChart])

  // Same dismissal behaviour as the metadata add menu.
  useEffect(() => {
    if (!colMenuOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setColMenuOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [colMenuOpen])

  const applyHidden = (next: Set<MeasurementKey>) => {
    setHiddenCols(next)
    try {
      window.localStorage.setItem(COLUMN_PREFS_KEY, JSON.stringify([...next]))
    } catch {
      // Preference is a convenience; failing to store it must not block editing.
    }
  }

  const filledCols = useMemo(() => columnsWithData(formData.rows), [formData.rows])
  const visibleColumns = MEASUREMENT_COLUMNS.filter((col) => !hiddenCols.has(col.key))
  const hiddenCount = MEASUREMENT_COLUMNS.length - visibleColumns.length
  // Surfaced in the notice: hiding never deletes anything, but a hidden column
  // holding values is worth calling out so it isn't forgotten on save.
  const hiddenWithData = MEASUREMENT_COLUMNS.filter((col) => hiddenCols.has(col.key) && filledCols.has(col.key)).length

  const toggleCol = (key: MeasurementKey) => {
    const next = new Set(hiddenCols)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    applyHidden(next)
  }

  const showAllCols = () => applyHidden(new Set())
  const hideEmptyCols = () =>
    applyHidden(new Set(MEASUREMENT_COLUMNS.filter((col) => !filledCols.has(col.key)).map((col) => col.key)))

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
              thigh_max: thigh.max,
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
    <form className="admin-form" onSubmit={handleSubmit}>
      <section className="admin-form-card">
        <div className="admin-form-card-head">
          <h2 className="admin-form-card-title">Chart Details</h2>
          <p className="admin-form-card-desc">
            Identifies this chart and the units its measurements are recorded in.
          </p>
        </div>

        <div className="admin-form-grid">
          <div className="admin-field admin-field--full">
            <label htmlFor="label" className="admin-label">
              Label <span className="admin-label-req">*</span>
            </label>
            <input
              type="text"
              className="admin-input"
              id="label"
              name="label"
              value={formData.label}
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
            <label htmlFor="measurement_unit" className="admin-label">
              Measurement Unit <span className="admin-label-req">*</span>
            </label>
            <select
              className="admin-select"
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
        </div>
      </section>

      <section className="admin-form-card admin-measure-card">
        <div className="admin-form-card-head">
          <h2 className="admin-form-card-title">Sizes &amp; Measurements</h2>
          <p className="admin-form-card-desc">
            One row per size. There are more measurements than fit on screen — scroll sideways; the size column stays
            pinned.
          </p>
          <div className="admin-form-hint">
            <Info size={15} className="admin-form-hint-icon" />
            <span>
              Enter a range like <code>32-34</code>, or a single value like <code>32</code> to record just an upper
              bound. Leave a cell empty to omit that measurement. Values are in {unitLabel}.
            </span>
          </div>

          <div className="admin-measure-toolbar">
            <div className="admin-col-toggle" ref={colMenuRef}>
              <button
                type="button"
                className="admin-form-btn"
                onClick={() => setColMenuOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={colMenuOpen}
              >
                <SlidersHorizontal size={15} />
                Columns
                <span className="admin-col-toggle-count">
                  {visibleColumns.length}/{MEASUREMENT_COLUMNS.length}
                </span>
              </button>

              {colMenuOpen && (
                <div className="admin-col-menu">
                  <div className="admin-col-menu-head">
                    <span className="admin-col-menu-title">Measurements</span>
                    <div className="admin-col-menu-acts">
                      <button type="button" className="admin-measure-link" onClick={showAllCols}>
                        Show all
                      </button>
                      <button type="button" className="admin-measure-link" onClick={hideEmptyCols}>
                        Hide empty
                      </button>
                    </div>
                  </div>
                  <div className="admin-col-menu-list">
                    {MEASUREMENT_COLUMNS.map((col) => {
                      const isVisible = !hiddenCols.has(col.key)
                      return (
                        <label key={col.key} className="admin-col-menu-item">
                          <input
                            type="checkbox"
                            className="admin-col-menu-native"
                            checked={isVisible}
                            onChange={() => toggleCol(col.key)}
                          />
                          <span className="admin-col-menu-box" aria-hidden="true">
                            {isVisible && <Check size={12} strokeWidth={3} />}
                          </span>
                          <span className="admin-col-menu-label">{col.label}</span>
                          {filledCols.has(col.key) && (
                            <span className="admin-col-menu-dot" title="Has values in this chart" />
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {hiddenCount > 0 && (
              <span className="admin-measure-hidden-note">
                {hiddenCount} {hiddenCount === 1 ? "column" : "columns"} hidden
                {hiddenWithData > 0 && ` (${hiddenWithData} with values)`}
                <button type="button" className="admin-measure-link" onClick={showAllCols}>
                  Show all
                </button>
              </span>
            )}
          </div>
        </div>

        {formData.rows.length === 0 ? (
          <p className="admin-measure-empty">No sizes yet. Add your first size to start building this chart.</p>
        ) : visibleColumns.length === 0 ? (
          /* Reachable by unchecking all 17 — without this the table renders as
             a bare Size + Remove pair with no obvious way back. */
          <p className="admin-measure-empty">
            Every measurement is hidden.{" "}
            <button type="button" className="admin-measure-link" onClick={showAllCols}>
              Show all columns
            </button>
          </p>
        ) : (
          <div className="admin-measure-scroll">
            <table className="admin-measure-table">
              <thead>
                <tr>
                  <th className="admin-measure-col-size">
                    Size <span className="admin-label-req">*</span>
                  </th>
                  {visibleColumns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                  <th>Remove</th>
                </tr>
              </thead>
              <tbody>
                {formData.rows.map((row, index) => (
                  <tr key={index}>
                    <td className="admin-measure-col-size">
                      <input
                        type="text"
                        className="admin-measure-input admin-measure-input--size"
                        name="size_label"
                        value={row.size_label}
                        onChange={(e) => handleRowChange(index, e)}
                        placeholder="e.g. M"
                        aria-label={`Size label, row ${index + 1}`}
                        required
                      />
                    </td>
                    {visibleColumns.map((col) => (
                      <td key={col.key}>
                        <input
                          type="text"
                          className="admin-measure-input"
                          name={col.key}
                          value={row[col.key]}
                          onChange={(e) => handleRowChange(index, e)}
                          aria-label={`${col.label}, row ${index + 1}`}
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="admin-measure-remove"
                        onClick={() => removeRow(index)}
                        aria-label={`Remove size ${row.size_label || index + 1}`}
                      >
                        <X size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-measure-foot">
          <button type="button" className="admin-form-btn" onClick={addRow}>
            <Plus size={16} />
            Add Size
          </button>
          {formData.rows.length > 0 && (
            <span className="admin-measure-count">
              {formData.rows.length} {formData.rows.length === 1 ? "size" : "sizes"}
            </span>
          )}
        </div>
      </section>

      <div className="admin-form-actions">
        <button type="submit" className="admin-form-btn admin-form-btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : sizeChart ? "Save Size Chart" : "Create Size Chart"}
        </button>
        <Link href="/admin/size-charts" className="admin-form-btn">
          Cancel
        </Link>
      </div>
    </form>
  )
}

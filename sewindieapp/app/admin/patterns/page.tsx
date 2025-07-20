"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Plus } from "lucide-react"
import { useSearchParams } from "next/navigation"
import PatternSearch from "@/components/PatternSearch"
import PatternSorter from "@/components/PatternSorter"
import PatternFilters from "@/components/PatternFilters"

type Pattern = {
  id: number
  name: string
  thumbnail_url: string | null
  designer: {
    id: number
    name: string
  }
  url: string
  difficulty: string | null
  release_date: string | null
}

type FilterOption = {
  id: number
  name: string
}

export default function PatternsPage() {
  const searchParams = useSearchParams()
  const initialSearchQuery = searchParams.get("search") || ""

  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [categories, setCategories] = useState<FilterOption[]>([])
  const [attributes, setAttributes] = useState<FilterOption[]>([])
  const [formats, setFormats] = useState<FilterOption[]>([])
  const [audiences, setAudiences] = useState<FilterOption[]>([])
  const [fabricTypes, setFabricTypes] = useState<FilterOption[]>([])
  const [designers, setDesigners] = useState<FilterOption[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPatternsAndFilters = async () => {
      setLoading(true)
      setError(null)
      try {
        const patternsResponse = await fetch(`/api/patterns?${searchParams.toString()}`)
        if (!patternsResponse.ok) {
          throw new Error("Failed to fetch patterns")
        }
        const patternsData = await patternsResponse.json()
        setPatterns(patternsData.patterns)

        const [categoriesRes, attributesRes, formatsRes, audiencesRes, fabricTypesRes, designersRes] =
          await Promise.all([
            fetch("/api/categories"),
            fetch("/api/attributes"),
            fetch("/api/formats"),
            fetch("/api/audiences"),
            fetch("/api/fabric-types"),
            fetch("/api/designers"),
          ])

        const [categoriesData, attributesData, formatsData, audiencesData, fabricTypesData, designersData] =
          await Promise.all([
            categoriesRes.json(),
            attributesRes.json(),
            formatsRes.json(),
            audiencesRes.json(),
            fabricTypesRes.json(),
            designersRes.json(),
          ])

        setCategories(categoriesData.categories || categoriesData)
        setAttributes(attributesData.attributes || attributesData)
        setFormats(formatsData.formats || formatsData)
        setAudiences(audiencesData.audiences || audiencesData)
        setFabricTypes(fabricTypesData.fabricTypes || fabricTypesData)
        setDesigners(designersData.designers || designersData)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }

    fetchPatternsAndFilters()
  }, [searchParams])

  if (loading) return <div className="p-4">Loading patterns...</div>
  if (error) return <div className="p-4 text-danger">Error: {error}</div>

  return (
    <div className="container-fluid admin-patterns-page">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Patterns</h1>
        <Link href="/admin/patterns/new" className="btn btn-primary">
          <Plus size={18} className="me-2" />
          Add Pattern
        </Link>
      </div>

      <div className="row mb-4">
        <div className="col-lg-3">
          <PatternFilters
            categories={categories}
            attributes={attributes}
            formats={formats}
            audiences={audiences}
            fabricTypes={fabricTypes}
            designers={designers}
          />
        </div>
        <div className="col-lg-9">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <PatternSearch initialSearch={initialSearchQuery} />
            <PatternSorter />
          </div>

          <div className="table-responsive">
            <table className="table table-striped table-hover">
              <thead>
                <tr>
                  <th>Thumbnail</th>
                  <th>Name</th>
                  <th>Designer</th>
                  <th>Difficulty</th>
                  <th>Release Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patterns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4">
                      No patterns found.
                    </td>
                  </tr>
                ) : (
                  patterns.map((pattern) => (
                    <tr key={pattern.id}>
                      <td>
                        {pattern.thumbnail_url ? (
                          <Image
                            src={pattern.thumbnail_url || "/placeholder.svg"}
                            alt={pattern.name}
                            width={50}
                            height={50}
                            className="rounded"
                          />
                        ) : (
                          <div className="bg-secondary rounded" style={{ width: 50, height: 50 }}></div>
                        )}
                      </td>
                      <td>{pattern.name}</td>
                      <td>{pattern.designer.name}</td>
                      <td>{pattern.difficulty || "-"}</td>
                      <td>{pattern.release_date ? new Date(pattern.release_date).toLocaleDateString() : "-"}</td>
                      <td>
                        <div className="btn-group">
                          <Link
                            href={`/admin/patterns/${pattern.id}/edit`}
                            className="btn btn-sm btn-outline-secondary"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

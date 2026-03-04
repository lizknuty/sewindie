"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

export function PatternSorter() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { replace } = useRouter()

  const sortBy = searchParams.get("sortBy") || "name"
  const sortOrder = searchParams.get("sortOrder") || "asc"

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams)
    const [newSortBy, newSortOrder] = value.split("-")
    params.set("sortBy", newSortBy)
    params.set("sortOrder", newSortOrder)
    replace(`${pathname}?${params.toString()}`)
  }

  return (
    <Select onValueChange={handleSortChange} value={`${sortBy}-${sortOrder}`}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Sort by" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="name-asc">Name (A-Z)</SelectItem>
        <SelectItem value="name-desc">Name (Z-A)</SelectItem>
        <SelectItem value="createdAt-desc">Newest First</SelectItem>
        <SelectItem value="createdAt-asc">Oldest First</SelectItem>
        <SelectItem value="designer.name-asc">Designer (A-Z)</SelectItem>
        <SelectItem value="designer.name-desc">Designer (Z-A)</SelectItem>
      </SelectContent>
    </Select>
  )
}

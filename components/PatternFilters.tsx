"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

interface FilterOption {
  id: number | string
  name?: string
  label?: string
  value?: string
}

interface PatternFiltersProps {
  designers: FilterOption[]
  categories: FilterOption[]
  audiences: FilterOption[]
  fabricTypes: FilterOption[]
  formats: FilterOption[]
  difficultyLevels: FilterOption[]
}

export function PatternFilters({
  designers,
  categories,
  audiences,
  fabricTypes,
  formats,
  difficultyLevels,
}: PatternFiltersProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { replace } = useRouter()

  const handleFilterChange = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set(name, value)
    } else {
      params.delete(name)
    }
    replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        onValueChange={(value) => handleFilterChange("designer", value)}
        value={searchParams.get("designer") || "all"}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by Designer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Designers</SelectItem>
          {designers.map((d) => (
            <SelectItem key={d.id} value={d.id.toString()}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(value) => handleFilterChange("category", value)}
        value={searchParams.get("category") || "all"}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id.toString()}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(value) => handleFilterChange("audience", value)}
        value={searchParams.get("audience") || "all"}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by Audience" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Audiences</SelectItem>
          {audiences.map((a) => (
            <SelectItem key={a.id} value={a.id.toString()}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(value) => handleFilterChange("fabricType", value)}
        value={searchParams.get("fabricType") || "all"}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by Fabric Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Fabric Types</SelectItem>
          {fabricTypes.map((ft) => (
            <SelectItem key={ft.id} value={ft.id.toString()}>
              {ft.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(value) => handleFilterChange("format", value)}
        value={searchParams.get("format") || "all"}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by Format" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Formats</SelectItem>
          {formats.map((f) => (
            <SelectItem key={f.id} value={f.id.toString()}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(value) => handleFilterChange("difficulty", value)}
        value={searchParams.get("difficulty") || "all"}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Filter by Difficulty" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Difficulties</SelectItem>
          {difficultyLevels.map((d) => (
            <SelectItem key={d.value} value={d.value as string}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

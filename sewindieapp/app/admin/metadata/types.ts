import type { AdminSizeChart } from "@/admin/size-charts/types"

/** Normalized row shape shared by the six simple lookup tables. */
export type MetadataItem = {
  id: number
  name: string
  patternCount: number
}

export type MetadataDataset = {
  items: MetadataItem[]
  sizeCharts: AdminSizeChart[]
}

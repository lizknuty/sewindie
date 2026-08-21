export interface AdminSizeChart {
  id: number
  label: string
  measurement_unit: string
  Designer: {
    id?: number
    name: string
  }
  _count?: {
    PatternSizeChart?: number
    SizeChartRow?: number
  }
}

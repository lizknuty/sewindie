export type DesignerStatus = "PUBLISHED" | "INACTIVE"

export type AdminDesigner = {
  id: number
  name: string | null
  logo_url: string | null
  url: string | null
  status: DesignerStatus
  _count?: {
    patterns: number
  }
}

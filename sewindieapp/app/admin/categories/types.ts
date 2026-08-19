export interface AdminCategory {
  id: number
  name: string
  _count?: {
    PatternCategory: number
  }
}

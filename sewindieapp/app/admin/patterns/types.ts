export type AdminPattern = {
  id: number
  name: string
  thumbnail_url: string | null
  designer: {
    id: number
    name: string
  } | null
  url: string
  difficulty: string | null
  release_date: string | null
  status: "PUBLISHED" | "IN_TESTING" | "DISCONTINUED"
  PatternCategory?: Array<{
    category: {
      id: number
      name: string
    }
  }>
}

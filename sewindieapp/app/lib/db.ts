import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
})

export async function query(text: string, params?: any[]) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  console.log('executed query', { text, duration, rows: res.rowCount })
  return res
}

export interface Designer {
  id: number;
  name: string;
  // Add other fields as necessary
}

export interface Pattern {
  id: number;
  name: string;
  designer_id: number;
  // Add other fields as necessary
}

export interface Category {
  id: number;
  name: string;
}

export interface Format {
  id: number;
  name: string;
}

export interface SuggestedFabric {
  id: number;
  name: string;
}

export interface Attribute {
  id: number;
  name: string;
}

// Add interfaces for junction tables if needed
export interface PatternCategory {
  pattern_id: number;
  category_id: number;
}

export interface PatternFormat {
  pattern_id: number;
  format_id: number;
}

export interface PatternSuggestedFabric {
  pattern_id: number;
  suggested_fabric_id: number;
}

export interface PatternAttribute {
  pattern_id: number;
  attribute_id: number;
}
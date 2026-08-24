import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import PatternForm from "../components/PatternForm"

export default function NewPatternPage() {
  return (
    <div className="admin-form-page">
      <header className="admin-form-header">
        <Link href="/admin/patterns" className="admin-form-back">
          <ArrowLeft size={15} />
          Back to Patterns
        </Link>
        <h1 className="admin-form-title">Add New Pattern</h1>
        <p className="admin-form-subtitle">Add a pattern to the directory and classify it for search and filtering.</p>
      </header>
      <PatternForm />
    </div>
  )
}

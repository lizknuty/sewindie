import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import DesignerForm from "../components/DesignerForm"

export default function NewDesignerPage() {
  return (
    <div className="admin-form-page">
      <header className="admin-form-header">
        <Link href="/admin/designers" className="admin-form-back">
          <ArrowLeft size={15} />
          Back to Designers
        </Link>
        <h1 className="admin-form-title">Add New Designer</h1>
        <p className="admin-form-subtitle">Create a new designer record for the directory.</p>
      </header>
      <DesignerForm />
    </div>
  )
}

import { getPatternContributions } from "@/lib/google-sheets"
import ContributionsTable from "./components/ContributionsTable"

export default async function ContributionsPage() {
  const contributions = await getPatternContributions()

  return (
    <div className="admin-patterns-page">
      <header className="patterns-page-header">
        <div>
          <h1 className="patterns-title">Contributions</h1>
          <p className="patterns-subtitle">
            Review pattern contributions submitted by the community, then approve, reject, or import them.
          </p>
        </div>
      </header>

      <ContributionsTable initialContributions={contributions} />
    </div>
  )
}

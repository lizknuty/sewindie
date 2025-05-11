import { getPatternContributions } from "@/lib/google-sheets"
import ContributionsTable from "./components/ContributionsTable"

export default async function ContributionsPage() {
  const contributions = await getPatternContributions()

  return (
    <div>
      <h1 className="mb-4">Pattern Contributions</h1>
      <p className="mb-4">
        Review and manage pattern contributions submitted by users. You can approve, reject, or import contributions as
        patterns.
      </p>

      <ContributionsTable initialContributions={contributions} />
    </div>
  )
}

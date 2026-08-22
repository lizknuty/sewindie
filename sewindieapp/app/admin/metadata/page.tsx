import { Suspense } from "react"
import MetadataView from "./components/MetadataView"

export const metadata = {
  title: "Pattern Metadata | SewIndie Admin",
}

export default function MetadataPage() {
  return (
    <Suspense fallback={<div className="patterns-empty">Loading metadata...</div>}>
      <MetadataView />
    </Suspense>
  )
}

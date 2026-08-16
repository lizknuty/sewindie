import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Resources | SewIndie",
  description: "Discover sewing resources, tutorials, and tools on SewIndie.",
}

export default function ResourcesPage() {
  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8 text-center">
          <h1 className="mb-4">Resources</h1>
          <p className="lead">This page is coming soon. Check back shortly for sewing resources.</p>
        </div>
      </div>
    </div>
  )
}

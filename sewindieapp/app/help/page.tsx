import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Help | SewIndie",
  description: "Find help and answers to common questions about using SewIndie.",
}

export default function HelpPage() {
  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8 text-center">
          <h1 className="mb-4">Help</h1>
          <p className="lead">This page is coming soon. Check back shortly for help and support.</p>
        </div>
      </div>
    </div>
  )
}

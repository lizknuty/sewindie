import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Contact | SewIndie",
  description: "Get in touch with the SewIndie team.",
}

export default function ContactPage() {
  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-8 text-center">
          <h1 className="mb-4">Contact</h1>
          <p className="lead">This page is coming soon. Check back shortly to reach out to us.</p>
        </div>
      </div>
    </div>
  )
}

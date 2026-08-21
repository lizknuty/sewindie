export default function BlogStatusBadge({ published }: { published: boolean }) {
  return (
    <span className={`status-badge ${published ? "status-published" : "status-draft"}`}>
      {published ? "Published" : "Draft"}
    </span>
  )
}

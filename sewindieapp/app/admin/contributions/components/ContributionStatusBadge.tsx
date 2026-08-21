const STATUS_CLASS: Record<string, string> = {
  Approved: "status-published",
  Rejected: "status-discontinued",
  Imported: "status-imported",
  Pending: "status-testing",
}

export default function ContributionStatusBadge({ status }: { status?: string }) {
  const label = status?.trim() || "Pending"
  const className = STATUS_CLASS[label] ?? "status-testing"

  return <span className={`status-badge ${className}`}>{label}</span>
}

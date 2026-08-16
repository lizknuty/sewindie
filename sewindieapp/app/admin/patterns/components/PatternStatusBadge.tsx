type PatternStatus = "PUBLISHED" | "IN_TESTING" | "DISCONTINUED"

const STATUS_META: Record<PatternStatus, { label: string; className: string }> = {
  PUBLISHED: { label: "Published", className: "status-badge status-published" },
  IN_TESTING: { label: "In Testing", className: "status-badge status-testing" },
  DISCONTINUED: { label: "Discontinued", className: "status-badge status-discontinued" },
}

export default function PatternStatusBadge({ status }: { status?: string | null }) {
  const meta = STATUS_META[(status as PatternStatus) ?? "PUBLISHED"] ?? STATUS_META.PUBLISHED
  return <span className={meta.className}>{meta.label}</span>
}

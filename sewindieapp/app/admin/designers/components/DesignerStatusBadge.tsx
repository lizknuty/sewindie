import type { DesignerStatus } from "@/admin/designers/types"

const STATUS_CONFIG: Record<DesignerStatus, { label: string; className: string }> = {
  PUBLISHED: { label: "Published", className: "status-published" },
  INACTIVE: { label: "Inactive", className: "status-discontinued" },
}

export default function DesignerStatusBadge({ status }: { status: DesignerStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PUBLISHED
  return <span className={`status-badge ${config.className}`}>{config.label}</span>
}

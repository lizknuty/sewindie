import Link from "next/link"

export const DESIGNER_TABS = ["patterns", "collections", "about", "reviews"] as const
export type DesignerTab = (typeof DESIGNER_TABS)[number]

const LABELS: Record<DesignerTab, string> = {
  patterns: "Patterns",
  collections: "Collections",
  about: "About",
  reviews: "Reviews",
}

/**
 * Tab bar for the designer page. These are real links rather than client-side
 * state so each tab is shareable, crawlable, and works without JS. Switching
 * tabs intentionally drops every other query param -- sort, view, and page all
 * belong to the patterns list and would be meaningless carried onto Reviews.
 */
export default function DesignerTabs({
  designerId,
  active,
}: {
  designerId: number
  active: DesignerTab
}) {
  return (
    <nav className="dtabs" aria-label="Designer sections">
      <ul className="dtabs-list">
        {DESIGNER_TABS.map((tab) => {
          const isActive = tab === active
          return (
            <li key={tab}>
              <Link
                href={
                  tab === "patterns"
                    ? `/designers/${designerId}`
                    : `/designers/${designerId}?tab=${tab}`
                }
                className={`dtab ${isActive ? "dtab-on" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                {LABELS[tab]}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

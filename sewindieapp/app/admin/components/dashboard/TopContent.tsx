"use client"

import { useState } from "react"
import Link from "next/link"
import { Scissors, Users } from "lucide-react"
import PatternThumbnail from "@/components/PatternThumbnail"
import type { TopPattern, TopDesigner } from "@/admin/lib/dashboard-data"

type Tab = "patterns" | "designers"

interface TopContentProps {
  patterns: TopPattern[]
  designers: TopDesigner[]
}

export default function TopContent({ patterns, designers }: TopContentProps) {
  const [tab, setTab] = useState<Tab>("patterns")

  return (
    <section className="admin-panel">
      <div className="admin-panel-head admin-panel-head--tabs">
        <h2 className="admin-panel-title">Top Content</h2>
        <div className="admin-tabs" role="tablist" aria-label="Top content type">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "patterns"}
            className={`admin-tab ${tab === "patterns" ? "active" : ""}`}
            onClick={() => setTab("patterns")}
          >
            Patterns
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "designers"}
            className={`admin-tab ${tab === "designers" ? "active" : ""}`}
            onClick={() => setTab("designers")}
          >
            Designers
          </button>
        </div>
      </div>

      {tab === "patterns" ? (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Pattern</th>
              <th className="admin-num">Favorites</th>
              <th className="admin-num">Ratings</th>
            </tr>
          </thead>
          <tbody>
            {patterns.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="admin-row-item">
                    <span className="admin-thumb">
                      {p.thumbnail_url ? (
                        <PatternThumbnail raw src={p.thumbnail_url} alt="" />
                      ) : (
                        <Scissors size={16} strokeWidth={1.5} />
                      )}
                    </span>
                    <div>
                      <p className="admin-row-title">{p.name}</p>
                      <p className="admin-row-sub">{p.designer?.name}</p>
                    </div>
                  </div>
                </td>
                <td className="admin-num">{p._count.favorites.toLocaleString()}</td>
                <td className="admin-num">{p._count.ratings.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Designer</th>
              <th className="admin-num">Patterns</th>
            </tr>
          </thead>
          <tbody>
            {designers.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="admin-row-item">
                    <span className="admin-thumb">
                      {d.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.logo_url || "/placeholder.svg"} alt="" />
                      ) : (
                        <Users size={16} strokeWidth={1.5} />
                      )}
                    </span>
                    <div>
                      <p className="admin-row-title">{d.name}</p>
                    </div>
                  </div>
                </td>
                <td className="admin-num">{d._count.patterns.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="admin-panel-foot">
        <Link
          href={tab === "patterns" ? "/admin/patterns" : "/admin/designers"}
          className="admin-ghost-btn"
        >
          View all {tab}
        </Link>
      </div>
    </section>
  )
}

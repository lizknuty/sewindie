"use client"

import { METADATA_TABS, type MetadataTabKey } from "../config"

type Props = {
  activeTab: MetadataTabKey
  counts: Partial<Record<MetadataTabKey, number>>
  onChange: (key: MetadataTabKey) => void
}

export default function MetadataTabs({ activeTab, counts, onChange }: Props) {
  return (
    <div className="metadata-tabs" role="tablist" aria-label="Metadata types">
      {METADATA_TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.key === activeTab
        const count = counts[tab.key]
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`metadata-tab-${tab.key}`}
            aria-selected={isActive}
            aria-controls="metadata-panel"
            className={`metadata-tab ${isActive ? "is-active" : ""}`}
            onClick={() => onChange(tab.key)}
          >
            <Icon size={17} strokeWidth={1.75} className="metadata-tab-icon" />
            <span className="metadata-tab-label">{tab.label}</span>
            <span className="metadata-tab-count">{count === undefined ? "—" : count.toLocaleString()}</span>
          </button>
        )
      })}
    </div>
  )
}

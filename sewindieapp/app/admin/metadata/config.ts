import { Tag, SlidersHorizontal, Layers, Shirt, FileType, UsersRound, Ruler, type LucideIcon } from "lucide-react"

export type MetadataTabKey =
  | "categories"
  | "attributes"
  | "fabric-types"
  | "suggested-fabrics"
  | "formats"
  | "audiences"
  | "size-charts"

export type MetadataTab = {
  key: MetadataTabKey
  label: string
  singular: string
  icon: LucideIcon
  /** API endpoint returning the list */
  apiPath: string
  /** Admin route base, used for /new and /[id]/edit links */
  basePath: string
  /** Key inside the API `_count` object holding the pattern relation count */
  countKey: string
  /** Some endpoints wrap the array in an object under this key */
  responseKey?: string
}

export const METADATA_TABS: MetadataTab[] = [
  {
    key: "categories",
    label: "Categories",
    singular: "Category",
    icon: Tag,
    apiPath: "/api/categories",
    basePath: "/admin/categories",
    countKey: "PatternCategory",
  },
  {
    key: "attributes",
    label: "Attributes",
    singular: "Attribute",
    icon: SlidersHorizontal,
    apiPath: "/api/attributes",
    basePath: "/admin/attributes",
    countKey: "PatternAttribute",
  },
  {
    key: "fabric-types",
    label: "Fabric Types",
    singular: "Fabric Type",
    icon: Layers,
    apiPath: "/api/fabric-types",
    basePath: "/admin/fabric-types",
    countKey: "PatternFabricType",
  },
  {
    key: "suggested-fabrics",
    label: "Suggested Fabrics",
    singular: "Suggested Fabric",
    icon: Shirt,
    apiPath: "/api/suggested-fabrics",
    basePath: "/admin/suggested-fabrics",
    countKey: "PatternSuggestedFabric",
    responseKey: "suggestedFabrics",
  },
  {
    key: "formats",
    label: "Formats",
    singular: "Format",
    icon: FileType,
    apiPath: "/api/formats",
    basePath: "/admin/formats",
    countKey: "PatternFormat",
  },
  {
    key: "audiences",
    label: "Audiences",
    singular: "Audience",
    icon: UsersRound,
    apiPath: "/api/audiences",
    basePath: "/admin/audiences",
    countKey: "PatternAudience",
  },
  {
    key: "size-charts",
    label: "Size Charts",
    singular: "Size Chart",
    icon: Ruler,
    apiPath: "/api/size-charts",
    basePath: "/admin/size-charts",
    countKey: "PatternSizeChart",
  },
]

export const DEFAULT_TAB: MetadataTabKey = "categories"

export function getTab(key: string | null | undefined): MetadataTab {
  return METADATA_TABS.find((t) => t.key === key) ?? METADATA_TABS[0]
}

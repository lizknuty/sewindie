import { extractBooAndLuMetadata } from "../app/lib/pattern-sync/metadata/boo-and-lu"
for (const name of ["B&L Basics: Pebble Flared Pants Digital Sewing Pattern (Sizes 1-14)", "Child & Adult Powell Relaxed Fit Tee & Hoodie Digital Sewing Pattern Bundle"]) {
  const m = extractBooAndLuMetadata({ name, slugs: ["b-l-basics-children"] })
  console.log(name, "=>", JSON.stringify(m.categories))
}

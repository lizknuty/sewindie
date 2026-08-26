/**
 * "Fibre Mood" -> "FM"; falls back to the first character for one-word names.
 *
 * Lived inside DesignerAvatar until the designers index needed the same
 * fallback for its logo tiles. Shared here so the two never disagree about
 * what a designer's initials are.
 */
export function initialsFor(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("")
}

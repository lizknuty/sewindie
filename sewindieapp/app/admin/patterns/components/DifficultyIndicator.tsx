export default function DifficultyIndicator({ difficulty }: { difficulty?: string | null }) {
  if (!difficulty) return <span className="text-muted">-</span>

  const value = difficulty.toLowerCase()
  let dotClass = "difficulty-dot difficulty-default"
  if (value.includes("begin")) dotClass = "difficulty-dot difficulty-beginner"
  else if (value.includes("inter")) dotClass = "difficulty-dot difficulty-intermediate"
  else if (value.includes("adv")) dotClass = "difficulty-dot difficulty-advanced"

  return (
    <span className="difficulty-indicator">
      <span className={dotClass} aria-hidden="true" />
      {difficulty}
    </span>
  )
}

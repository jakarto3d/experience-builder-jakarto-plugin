/** Formats a Jakarto image date for display (fr-CA, e.g. "13 juil. 2026"). */
export function formatJakartoDate(dateString: string | null): string | null {
  if (!dateString) return null
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

// =========================================
// CASHFLOW COUNTERPARTY UTILITIES
// Shared between PDF report and dashboard.
// =========================================

/**
 * Extracts the raw counterparty name from a Revolut transaction description.
 * Handles the common patterns:
 *   "Money added from X"  →  X
 *   "To X"                →  X
 *   "From X"              →  X
 *   anything else         →  description as-is
 */
export function extractCounterparty(description: string): string {
  let m: RegExpMatchArray | null
  if ((m = description.match(/^Money added from\s+(.+)$/i))) return m[1].trim()
  if ((m = description.match(/^To\s+(.+)$/i))) return m[1].trim()
  if ((m = description.match(/^From\s+(.+)$/i))) return m[1].trim()
  return description.trim() || 'Desconocido'
}

/**
 * Normalises a raw counterparty name to a canonical display name.
 * Comparison is case-insensitive; the canonical name is returned as-is.
 *
 * Known normalisations:
 *   "smashburger sl", "smashburger sl.", "smashburger sl (revolut)" → "Smashburger SL"
 *   "sergio c", "sergio cerro", "sergio cerro pascual",
 *   "sergio cerro pascual pascual" → "Sergio Cerro"
 */
export function normalizeCounterparty(raw: string): string {
  const lower = raw.toLowerCase().trim()
  if (lower === 'sergio c' || lower.startsWith('sergio cerro')) return 'Sergio Cerro'
  if (lower.startsWith('smashburger'))                          return 'Smashburger SL'
  return raw.trim()
}

export interface CounterpartyEntry {
  name: string
  recibido: number
  dado: number
  neto: number
}

/**
 * Groups loan transactions by normalised counterparty name.
 * All transactions with category === 'Préstamos'; sign of amount determines direction:
 *   amount > 0  → recibido (money received / lent to us)
 *   amount < 0  → devuelto (money paid back by us)
 * Returns entries sorted by |neto| descending (largest exposure first).
 */
export function buildCounterpartyMap(
  transactions: Array<{ category: string; description: string; amount: number }>,
): CounterpartyEntry[] {
  const map = new Map<string, { recibido: number; dado: number }>()

  for (const t of transactions) {
    if (t.category !== 'Préstamos') continue
    const raw  = extractCounterparty(t.description ?? '')
    const name = normalizeCounterparty(raw)
    const e    = map.get(name) ?? { recibido: 0, dado: 0 }
    if (t.amount > 0) e.recibido += t.amount
    else              e.dado     += Math.abs(t.amount)
    map.set(name, e)
  }

  return Array.from(map.entries())
    .map(([name, { recibido, dado }]) => ({ name, recibido, dado, neto: recibido - dado }))
    .sort((a, b) => Math.abs(b.neto) - Math.abs(a.neto))
}

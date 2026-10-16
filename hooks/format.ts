export const oneLine = (text: string): string => text.replace(/\s+/g, ' ').trim()

export const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`

export const label = (text: string): string => (text.trim() === '' ? '(attachment)' : text)

// Rebuilt prompts have no time; the blank keeps the column aligned.
export const clock = (at: number | undefined): string => {
  if (at === undefined) return '     '

  const d = new Date(at)

  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const duration = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))

  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`

  return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, '0')}m`
}

// How long the prompt's turn ran: running, finished, or cut short; '' before it starts.
export const timing = (
  entry: { startedAt?: number; durationMs?: number; outcome?: string },
  now: number,
): string => {
  if (entry.durationMs !== undefined) {
    if (entry.outcome === 'aborted') return `stopped after ${duration(entry.durationMs)}`
    if (entry.outcome === 'error' || entry.outcome === 'refusal') return `ended after ${duration(entry.durationMs)}`

    return `took ${duration(entry.durationMs)}`
  }

  return entry.startedAt === undefined ? '' : `${duration(now - entry.startedAt)}…`
}

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

import { describe, expect, test } from 'claude-code/testing'

import { clip, clock, label, oneLine } from './format'

describe('oneLine', () => {
  test('collapses newlines and runs of whitespace to single spaces', async () => {
    expect(oneLine('fix the\n\n  auth   flow\r\nplease')).toBe('fix the auth flow please')
  })
  test('trims the ends', async () => {
    expect(oneLine('  hi \n')).toBe('hi')
  })
})

describe('clip', () => {
  test('leaves short text alone', async () => {
    expect(clip('short', 10)).toBe('short')
  })
  test('cuts long text to max characters ending in an ellipsis', async () => {
    const out = clip('x'.repeat(5000), 50)
    expect(out.length).toBe(50)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('label', () => {
  test('whitespace-only text reads as an attachment', async () => {
    expect(label('   \n ')).toBe('(attachment)')
  })
  test('other text is kept as is', async () => {
    expect(label('hello\nworld')).toBe('hello\nworld')
  })
})

describe('clock', () => {
  test('formats local time as HH:MM', async () => {
    expect(clock(new Date(2026, 9, 7, 14, 2).getTime())).toBe('14:02')
    expect(clock(new Date(2026, 9, 7, 9, 5).getTime())).toBe('09:05')
  })
  test('a missing time is a blank of the same width', async () => {
    expect(clock(undefined)).toBe('     ')
  })
})

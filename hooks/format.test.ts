import { describe, expect, test } from 'claude-code/testing'

import { clip, clock, duration, label, oneLine, timing } from './format'

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
  test('formats local time as YYYY-MM-DD HH:MM:SS', async () => {
    expect(clock(new Date(2026, 9, 7, 14, 2, 5).getTime())).toBe('2026-10-07 14:02:05')
    expect(clock(new Date(2026, 0, 3, 9, 5, 0).getTime())).toBe('2026-01-03 09:05:00')
  })
  test('a missing time is a blank of the same width', async () => {
    expect(clock(undefined)).toBe(' '.repeat(19))
  })
})

describe('duration', () => {
  test('seconds, then minutes and seconds, then hours and minutes', async () => {
    expect(duration(0)).toBe('0s')
    expect(duration(42_900)).toBe('42s')
    expect(duration(83_000)).toBe('1m 23s')
    expect(duration(3_600_000 + 2 * 60_000)).toBe('1h 02m')
  })
  test('a negative span reads as zero', async () => {
    expect(duration(-5)).toBe('0s')
  })
})

describe('timing', () => {
  test('nothing before the turn starts', async () => {
    expect(timing({}, 1000)).toBe('')
  })
  test('the elapsed time while running', async () => {
    expect(timing({ startedAt: 1000 }, 43_000)).toBe('42s…')
  })
  test('how the turn ended', async () => {
    expect(timing({ startedAt: 0, durationMs: 83_000, outcome: 'answer' }, 0)).toBe('took 1m 23s')
    expect(timing({ startedAt: 0, durationMs: 12_000, outcome: 'aborted' }, 0)).toBe('stopped after 12s')
    expect(timing({ startedAt: 0, durationMs: 5_000, outcome: 'error' }, 0)).toBe('ended after 5s')
  })
})

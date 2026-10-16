import { expect, mock, test } from 'claude-code/testing'

const SURFACES = ['terminal', 'desktop'] as const
const PANE_PROPS = {
  title: 'Prompts',
  isFocused: false,
  bodyColumns: 40,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
}
const VIEWPORT = { columns: 44, rows: 24 }

// Submits as the person at the terminal; the test kit leaves origin to the test.
const submit = ($: any, text: string, kind = 'composer') => $.prompt.submit({ text, origin: { kind } } as any)

// The engine's own prompt.submit answer, which the test kit leaves to the test.
const answerSubmit = (on: any) => on('prompt.submit', async (_$: any, e: any) => ({ text: e.text }))

test('a prompt passes through unchanged', async ($, on) => {
  mock.clock(on)
  const seen: string[] = []
  on('prompt.submit', async (_$, e) => {
    seen.push(e.text)
    return { text: e.text }
  })
  const out = await submit($, 'keep me exactly')
  expect(seen).toEqual(['keep me exactly'])
  expect(out).toMatchObject({ text: 'keep me exactly' })
})

test('the pane shows the empty state before any prompt', async $ => {
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'prompt-pin', surface, component: 'Pane', requestId: 'prompt-pin', props: PANE_PROPS, viewport: VIEWPORT })
    expect(await ui.find({ type: 'Text', text: 'No prompts yet.' })).toBeDefined()
    await ui.unmount()
  }
})

test('the pane lists prompts newest first, newest marked', async ($, on) => {
  answerSubmit(on)
  mock.clock(on, { now: Date.UTC(2026, 9, 7, 14, 0) })
  await submit($, 'first')
  await submit($, 'second')
  await submit($, 'third')
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'prompt-pin', surface, component: 'Pane', requestId: 'prompt-pin', props: PANE_PROPS, viewport: VIEWPORT })
    const rows = await ui.findAll({ type: 'Text', text: /first|second|third/ })
    expect(rows.map(r => r.text.replace(/^.*?(first|second|third).*$/s, '$1'))).toEqual(['third', 'second', 'first'])
    expect(rows[0]?.text).toContain('▶')
    expect(rows[1]?.text).not.toContain('▶')
    await ui.unmount()
  }
})

test('history is capped at 100', async ($, on) => {
  answerSubmit(on)
  mock.clock(on)
  for (let i = 0; i < 105; i += 1) await submit($, `p${i}`)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'prompt-pin', surface, component: 'Pane', requestId: 'prompt-pin', props: PANE_PROPS, viewport: VIEWPORT })
    const rows = await ui.findAll({ type: 'Text', text: /^.*p\d+/ })
    expect(rows).toHaveLength(100)
    expect(rows[0]?.text).toContain('p104')
    expect(rows[99]?.text).toContain('p5')
    await ui.unmount()
  }
})

test('the pane lists every prompt in a normal terminal', async ($, on) => {
  answerSubmit(on)
  mock.clock(on)
  for (let i = 0; i < 30; i += 1) await submit($, `q${i}`)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'prompt-pin', surface, component: 'Pane', requestId: 'prompt-pin', props: PANE_PROPS, viewport: VIEWPORT })
    expect(await ui.findAll({ type: 'Text', text: /q\d+/ })).toHaveLength(30)
    await ui.unmount()
  }
})

test('a dropped prompt is not recorded', async ($, on) => {
  mock.clock(on)
  on('prompt.submit', async () => ({ drop: 'refused' }))
  await submit($, 'nope')
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'prompt-pin', surface, component: 'Pane', requestId: 'prompt-pin', props: PANE_PROPS, viewport: VIEWPORT })
    expect(await ui.find({ type: 'Text', text: 'No prompts yet.' })).toBeDefined()
    await ui.unmount()
  }
})

test('a whitespace-only prompt shows as an attachment', async ($, on) => {
  answerSubmit(on)
  mock.clock(on)
  await submit($, '   ')
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'prompt-pin', surface, component: 'Pane', requestId: 'prompt-pin', props: PANE_PROPS, viewport: VIEWPORT })
    expect(await ui.find({ type: 'Text', text: '(attachment)' })).toBeDefined()
    await ui.unmount()
  }
})

test('a multi-line prompt shows on one flowing line', async ($, on) => {
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'l1\nl2\nl3\nl4\nl5\nl6')
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'prompt-pin', surface, component: 'Pane', requestId: 'prompt-pin', props: PANE_PROPS, viewport: VIEWPORT })
    const row = await ui.find({ type: 'Text', text: /l1/ })
    expect(row?.text).not.toContain('\n')
    expect(row?.text).toContain('l1 l2 l3')
    await ui.unmount()
  }
})

test('the pane draws without a viewport', async ($, on) => {
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'unmeasured')
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'prompt-pin', surface, component: 'Pane', requestId: 'prompt-pin', props: PANE_PROPS })
    expect(await ui.find({ type: 'Text', text: /unmeasured/ })).toBeDefined()
    await ui.unmount()
  }
})

// The engine's record of open panes, which the test kit leaves to the test.
const answerPanes = (on: any, ids: string[]) =>
  on('ui.panes', async () => ({ value: ids.map(id => ({ id, title: id, isShown: true, isFocused: true, isPlaced: true })) }))

test('/prompts opens the pane', async ($, on) => {
  answerPanes(on, [])
  const opened: unknown[] = []
  on('ui.open', async (_$, e) => {
    opened.push(e)
    return { value: { isPlaced: true } }
  })
  const out = await $.command.run({ command: 'prompts', args: '' } as any)
  expect(out).toMatchObject({ text: 'Prompts pane opened.' })
  expect(opened).toMatchObject([{ id: 'prompt-pin', title: 'Prompts', focus: true, closeOnEscape: true }])
})

test('/prompts closes the pane when it is already open', async ($, on) => {
  const open: string[] = []
  const closed: unknown[] = []
  answerPanes(on, open)
  on('ui.open', async (_$, e) => {
    open.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', async (_$, e) => {
    closed.push(e)
    return { value: undefined }
  })
  await $.command.run({ command: 'prompts', args: '' } as any)
  const out = await $.command.run({ command: 'prompts', args: '' } as any)
  expect(out).toMatchObject({ text: 'Prompts pane closed.' })
  expect(closed).toMatchObject([{ id: 'prompt-pin' }])
})

const BAND = (isWorking: boolean, hasSurvey = false) => ({
  hasSurvey,
  isWorking,
  maxRows: 10,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
})

const mountBand = ($: any, surface: 'terminal' | 'desktop', props: ReturnType<typeof BAND>) =>
  $.ui.mount({ plugin: 'prompt-pin', surface, component: 'AbovePrompt', props, viewport: { columns: 80, rows: 24 } })

// Text takes no key, so the pin is found by its marker.
const findPin = (ui: any) => ui.find({ type: 'Text', text: /^📌/ })

// What the engine draws when the band passes: an empty Box, so a hide test has a tree to read.
const answerBand = (on: any) =>
  on('ui.render', async ($: any, e: any) => {
    const { Box } = $.ui.resolve(e)

    return <Box />
  })

test('the band pins the latest prompt while working', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'older')
  await submit($, 'build a pinned prompt band')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findPin(ui))?.text).toBe('📌 build a pinned prompt band')
    expect(await ui.find({ key: 'history' })).toBeDefined()
    await ui.unmount()
  }
})

test('the band ignores a prompt that is not the user\'s', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'real prompt')
  await submit($, 'task done', 'task-notification')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findPin(ui))?.text).toBe('📌 real prompt')
    await ui.unmount()
  }
})

test('the band records a composer prompt', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'first')
  await submit($, 'typed by hand')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findPin(ui))?.text).toBe('📌 typed by hand')
    await ui.unmount()
  }
})

test('the band collapses a multi-line prompt to one row', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'line one\nline two\n\nline three')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findPin(ui))?.text).toBe('📌 line one line two line three')
    await ui.unmount()
  }
})

test('a long prompt stays one row', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'y'.repeat(5000))
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    const pin = await findPin(ui)
    expect(pin?.props.wrap).toBe('truncate-end')
    expect(pin?.text.length).toBeLessThanOrEqual(80)
    await ui.unmount()
  }
})

test('the band stays up, dimmed, when idle', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'still here')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(false))
    const pin = await findPin(ui)
    expect(pin?.text).toBe('📌 still here')
    expect(pin?.props.dimColor).toBe(true)
    expect(await ui.find({ key: 'history' })).toBeDefined()
    await ui.unmount()
  }
})

test('the band is not dimmed while working', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'in progress')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findPin(ui))?.props.dimColor).not.toBe(true)
    await ui.unmount()
  }
})

test('the band stays out of the way when a survey is up', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'hidden')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true, true))
    expect(await findPin(ui)).toBeUndefined()
    await ui.unmount()
  }
})

test('the band passes when there is no prompt yet', async ($, on) => {
  answerBand(on)
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect(await findPin(ui)).toBeUndefined()
    await ui.unmount()
  }
})

test('the History button opens the pane', async ($, on) => {
  answerBand(on)
  const opened: unknown[] = []
  on('ui.open', async (_$, e) => {
    opened.push(e)
    return { value: { isPlaced: true } }
  })
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'x')
  for (const surface of SURFACES) {
    opened.length = 0
    const ui = await mountBand($, surface, BAND(true))
    await ui.press({ key: 'history' })
    expect(opened).toMatchObject([{ id: 'prompt-pin', focus: true, closeOnEscape: true }])
    await ui.unmount()
  }
})

test('the band ignores a prompt another plugin submitted', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'mine')
  await submit($, 'from a background mod', 'plugin')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findPin(ui))?.text).toBe('📌 mine')
    await ui.unmount()
  }
})

test('the band records the prompt as rewritten by a later mod', async ($, on) => {
  answerBand(on)
  on('prompt.submit', async () => ({ text: 'rewritten' }))
  mock.clock(on)
  await submit($, 'as typed')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findPin(ui))?.text).toBe('📌 rewritten')
    await ui.unmount()
  }
})

test('typing /prompts is not recorded', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'real work')
  await submit($, '/prompts')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findPin(ui))?.text).toBe('📌 real work')
    await ui.unmount()
  }
})

test('the band keeps what later mods draw there', async ($, on) => {
  on('ui.render', async ($: any, e: any) => {
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text>branch: main</Text>
      </Box>
    )
  })
  answerSubmit(on)
  mock.clock(on)
  await submit($, 'pinned')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findPin(ui))?.text).toBe('📌 pinned')
    expect(await ui.find({ type: 'Text', text: 'branch: main' })).toBeDefined()
    await ui.unmount()
  }
})

test('/prompts is registered to run mid-turn', async ($, on) => {
  const registered: unknown[] = []
  on('command.register', async (_$, e) => {
    registered.push(e)
    return { value: { command: e.name } }
  })
  on('session.start', async (_$: any, e: any) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as any)
  expect(registered).toMatchObject([{ name: 'prompts', immediate: true }])
})

for (const source of ['resume', 'fork'] as const) {
  test(`history is rebuilt from the transcript after ${source}`, async ($, on) => {
    on('session.messages', async () => ({
      value: [
        { role: 'user', text: 'first ask', toolUses: [] },
        { role: 'assistant', text: 'ok', toolUses: [] },
        { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 't', text: 'out', isError: false }] },
        { role: 'user', text: '<task-notification>done</task-notification>', toolUses: [] },
        { role: 'user', text: '/prompts', toolUses: [] },
        { role: 'user', text: 'second ask', toolUses: [] },
      ],
    }))
    on('classic.SessionStart', () => ({}))
    await $.classic.SessionStart({ source } as any)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({ plugin: 'prompt-pin', surface, component: 'Pane', requestId: 'prompt-pin', props: PANE_PROPS, viewport: VIEWPORT })
      const rows = await ui.findAll({ type: 'Text', text: /ask|done|prompts/ })
      // Rebuilt rows have no time: a blank as wide as one stands in for it.
      expect(rows.map(r => r.text.trim())).toEqual([`▶ ${' '.repeat(19)} second ask`, 'first ask'])
      await ui.unmount()
    }
  })
}

// The engine's own turn answers, which the test kit leaves to the test.
const answerTurns = (on: any) => {
  on('turn.start', async (_$: any, e: any) => ({ turnId: e.turnId }))
  on('turn.complete', async () => ({ text: '' }))
}
const T0 = new Date(2026, 9, 7, 14, 0).getTime()
// Text takes no key, so the timing is found by its leading date.
const findTiming = (ui: any) => ui.find({ type: 'Text', text: /^ \d{4}-\d\d-\d\d / })
const complete = ($: any, turnId: string, durationMs: number, reason = 'answer', agentId?: string) =>
  $.turn.complete({ turnId, durationMs, reason, isAborted: reason === 'aborted', answer: '', agentId } as any)

test('the band shows when the prompt was sent and counts up while it runs', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  answerTurns(on)
  const clock = mock.clock(on, { now: T0 })
  await submit($, 'build it')
  await $.turn.start({ text: 'build it', turnId: 't1' })
  await clock.advance(42_000)
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findTiming(ui))?.text.trim()).toBe('2026-10-07 14:00:00 · 42s…')
    expect((await findPin(ui))?.text).toBe('📌 build it')
    await ui.unmount()
  }
})

test('a turn that starts before its prompt is recorded is still timed', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  answerTurns(on)
  const clock = mock.clock(on, { now: T0 })
  await $.turn.start({ text: 'idle start', turnId: 't1' })
  await submit($, 'idle start')
  await clock.advance(5_000)
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findTiming(ui))?.text.trim()).toBe('2026-10-07 14:00:00 · 5s…')
    await ui.unmount()
  }
})

test('the band shows how long the prompt took once its turn ends', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  answerTurns(on)
  mock.clock(on, { now: T0 })
  await submit($, 'done soon')
  await $.turn.start({ text: 'done soon', turnId: 't1' })
  await complete($, 't1', 83_000)
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(false))
    expect((await findTiming(ui))?.text.trim()).toBe('2026-10-07 14:00:00 · took 1m 23s')
    await ui.unmount()
  }
})

test('an interrupted turn reads as stopped', async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  answerTurns(on)
  mock.clock(on, { now: T0 })
  await submit($, 'never mind')
  await $.turn.start({ text: 'never mind', turnId: 't1' })
  await complete($, 't1', 12_000, 'aborted')
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(false))
    expect((await findTiming(ui))?.text.trim()).toBe('2026-10-07 14:00:00 · stopped after 12s')
    await ui.unmount()
  }
})

test("a subagent's turn and another prompt's turn leave the timing alone", async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  answerTurns(on)
  const clock = mock.clock(on, { now: T0 })
  await submit($, 'mine')
  await $.turn.start({ text: 'mine', turnId: 't1' })
  await complete($, 't1', 1_000, 'answer', 'agent-1')
  await $.turn.start({ text: 'a notification', turnId: 't2' })
  await clock.advance(3_000)
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findTiming(ui))?.text.trim()).toBe('2026-10-07 14:00:00 · 3s…')
    await ui.unmount()
  }
})

test('the pane shows each prompt with how long it took', async ($, on) => {
  answerSubmit(on)
  answerTurns(on)
  mock.clock(on, { now: T0 })
  await submit($, 'first')
  await $.turn.start({ text: 'first', turnId: 't1' })
  await complete($, 't1', 83_000)
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'prompt-pin', surface, component: 'Pane', requestId: 'prompt-pin', props: PANE_PROPS, viewport: VIEWPORT })
    expect((await ui.find({ type: 'Text', text: /first/ }))?.text).toContain('2026-10-07 14:00:00 first · took 1m 23s')
    await ui.unmount()
  }
})

test("a queued prompt isn't timed by another turn that starts first", async ($, on) => {
  answerBand(on)
  answerSubmit(on)
  answerTurns(on)
  const clock = mock.clock(on, { now: T0 })
  await submit($, 'queued behind')
  await $.turn.start({ text: 'a notification', turnId: 't1' })
  await clock.advance(7_000)
  for (const surface of SURFACES) {
    const ui = await mountBand($, surface, BAND(true))
    expect((await findTiming(ui))?.text.trim()).toBe('2026-10-07 14:00:00')
    await ui.unmount()
  }
})

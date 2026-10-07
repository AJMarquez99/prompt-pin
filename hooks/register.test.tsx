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

const submit = ($: any, text: string) => $.prompt.submit({ text, wait: false })

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
  const ui = await $.ui.mount({ plugin: 'prompt-pin', surface: 'terminal', component: 'Pane', requestId: 'prompt-pin', props: { ...PANE_PROPS, scroll: { offset: 0, bodyRows: 500 } }, viewport: { columns: 44, rows: 1000 } })
  const rows = await ui.findAll({ type: 'Text', text: /^.*p\d+/ })
  expect(rows).toHaveLength(100)
  expect(rows[0]?.text).toContain('p104')
  expect(rows[99]?.text).toContain('p5')
  await ui.unmount()
})

test('a whitespace-only prompt shows as an attachment', async ($, on) => {
  answerSubmit(on)
  mock.clock(on)
  await submit($, '   ')
  const ui = await $.ui.mount({ plugin: 'prompt-pin', surface: 'terminal', component: 'Pane', requestId: 'prompt-pin', props: PANE_PROPS, viewport: VIEWPORT })
  expect(await ui.find({ type: 'Text', text: '(attachment)' })).toBeDefined()
  await ui.unmount()
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

test('/prompts opens the pane', async ($, on) => {
  const opened: unknown[] = []
  on('ui.open', async (_$, e) => {
    opened.push(e)
    return { value: { isPlaced: true } }
  })
  const out = await $.command.run({ command: 'prompts', args: '' } as any)
  expect(out).toMatchObject({ text: 'Prompts pane opened.' })
  expect(opened).toMatchObject([{ id: 'prompt-pin', title: 'Prompts' }])
})

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { PromptEntry } from '../types'
import { clip, clock, label, oneLine } from './format'

const PANE = 'prompt-pin'
const CAP = 100
// A person's own prompts: typed at the terminal, or sent over Remote Control or the SDK host.
const USER_ORIGINS: readonly string[] = ['composer', 'bridge', 'sdk']
// The pane takes the keyboard so Esc closes it, like the engine's own views.
const OPEN = { id: PANE, title: 'Prompts', focus: true, closeOnEscape: true } as const
const history = atom({ plugin: 'prompt-pin', key: 'history' } as const, [] as PromptEntry[])

// The toggle is not a prompt worth pinning.
const isOwnCommand = (text: string): boolean => /^\/prompts(\s|$)/.test(text.trim())

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'prompts', description: "Show this session's prompts in a pane", immediate: true })

    return next(e)
  })

  // /resume and /branch reset $.state, so rebuild the history from the transcript.
  // The transcript keeps no times, and other user-role rows (notifications, peer
  // messages) arrive wrapped in a tag, so those are skipped.
  on('classic.SessionStart', { source: ['resume', 'fork'] }, async ($, e, next) => {
    const entries = (await $.session.messages())
      .filter(m => m.role === 'user' && (m.toolResults ?? []).length === 0)
      .map(m => m.text.trim())
      .filter(text => text !== '' && !text.startsWith('<') && !isOwnCommand(text))
      .map((text): PromptEntry => ({ text }))
    await update($, history, () => entries.slice(-CAP))

    return next(e)
  })

  on('command.run', { command: 'prompts' }, async $ => {
    if ((await $.ui.panes()).some(pane => pane.id === PANE)) {
      await $.ui.close({ id: PANE })

      return { text: 'Prompts pane closed.' }
    }

    await $.ui.open(OPEN)

    return { text: 'Prompts pane opened.' }
  })

  on('prompt.submit', async ($, e, next) => {
    const out = await next(e)

    // Record what entered, after any later mod's rewrite.
    if (USER_ORIGINS.includes(e.origin.kind) && out.drop === undefined && !isOwnCommand(out.text)) {
      const entry: PromptEntry = { text: out.text, at: await $.clock.now() }
      await update($, history, list => [...list, entry].slice(-CAP))
    }

    return out
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = [...(await read($, history))].reverse()
    // Approximates 3 wrapped rows by character count.
    const max = Math.max(20, e.props.bodyColumns * 3 - 8)

    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>No prompts yet.</Text>}
        {list.map((entry, i) => (
          <Text bold={i === 0} dimColor={i !== 0}>
            {i === 0 ? '▶ ' : '  '}
            {clock(entry.at)} {clip(oneLine(label(entry.text)), max)}
          </Text>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await read($, history)
    const latest = list[list.length - 1]

    if (e.props.hasSurvey || latest === undefined) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    // Leave room for the button; the surface also truncates at the edge.
    const max = Math.max(10, e.props.bodyColumns - 14)
    // Keep what the mods after this one draw in the band, under the pin.
    const theirs = await next(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row">
          <Box flexGrow={1}>
            <Text wrap="truncate-end" dimColor={!e.props.isWorking}>
              📌 {clip(oneLine(label(latest.text)), max)}
            </Text>
          </Box>
          <Button key="history" label="History" onPress={() => $.ui.open(OPEN)} />
        </Box>
        {theirs}
      </Box>
    )
  })
}

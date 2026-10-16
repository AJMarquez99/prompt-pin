import { atom, read, update } from 'claude-code'
import type { Register, Timer } from 'claude-code'

import type { PromptEntry, TurnMark } from '../types'
import { clip, clock, label, oneLine, timing } from './format'

const PANE = 'prompt-pin'
const CAP = 100
// A person's own prompts: typed at the terminal, or sent over Remote Control or the SDK host.
const USER_ORIGINS: readonly string[] = ['composer', 'bridge', 'sdk']
// The pane takes the keyboard so Esc closes it, like the engine's own views.
const OPEN = { id: PANE, title: 'Prompts', focus: true, closeOnEscape: true } as const
const history = atom({ plugin: 'prompt-pin', key: 'history' } as const, [] as PromptEntry[])
const pending = atom({ plugin: 'prompt-pin', key: 'pending' } as const, null as TurnMark | null)
// The time the running turn's elapsed count is drawn at, moved on each second.
const now = atom({ plugin: 'prompt-pin', key: 'now' } as const, 0)

// The toggle is not a prompt worth pinning.
const isOwnCommand = (text: string): boolean => /^\/prompts(\s|$)/.test(text.trim())

export const register: Register = on => {
  let tick: Timer | undefined

  // A turn starts before or after its prompt is recorded, depending on whether the
  // session was idle, so the turn and the prompt each look for the other.
  on('turn.start', async ($, e, next) => {
    const at = await $.clock.now()
    const latest = (await read($, history)).at(-1)

    if (latest !== undefined && latest.turnId === undefined && latest.at !== undefined && latest.text === e.text) {
      await update($, history, list => [...list.slice(0, -1), { ...latest, turnId: e.turnId, startedAt: at }])
    } else {
      await update($, pending, () => ({ turnId: e.turnId, text: e.text, at }))
    }

    await update($, now, () => at)
    tick?.cancel()
    tick = $.clock.every(1000, () => {
      void $.clock.now().then(t => update($, now, () => t))
    })

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    // A subagent's runs are turns too; only the main loop's belong to a prompt.
    if (e.agentId === undefined) {
      tick?.cancel()
      tick = undefined
      await update($, history, list =>
        list.map(entry => (entry.turnId === e.turnId ? { ...entry, durationMs: e.durationMs, outcome: e.reason } : entry)),
      )
      await update($, pending, mark => (mark?.turnId === e.turnId ? null : mark))
    }

    return next(e)
  })

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
      const mark = await read($, pending)
      const started = mark !== null && mark.text === out.text ? mark : null
      const entry: PromptEntry = { text: out.text, at: await $.clock.now() }

      if (started !== null) {
        entry.turnId = started.turnId
        entry.startedAt = started.at
        await update($, pending, () => null)
      }

      await update($, history, list => [...list, entry].slice(-CAP))
    }

    return out
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = [...(await read($, history))].reverse()
    const at = await read($, now)
    // Approximates 3 wrapped rows by character count.
    const max = Math.max(20, e.props.bodyColumns * 3 - 8)

    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>No prompts yet.</Text>}
        {list.map((entry, i) => {
          const spent = timing(entry, at)

          return (
            <Text bold={i === 0} dimColor={i !== 0}>
              {i === 0 ? '▶ ' : '  '}
              {clock(entry.at)} {clip(oneLine(label(entry.text)), max)}
              {spent === '' ? '' : ` · ${spent}`}
            </Text>
          )
        })}
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
    const spent = timing(latest, await read($, now))
    const when = latest.at === undefined ? '' : clock(latest.at)
    const info = [when, spent].filter(part => part !== '').join(' · ')
    // Leave room for the time and the button; the surface also truncates at the edge.
    const max = Math.max(10, e.props.bodyColumns - 14 - (info === '' ? 0 : info.length + 2))
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
          {info !== '' && (
            <Text dimColor>
              {` ${info} `}
            </Text>
          )}
          <Button key="history" label="History" onPress={() => $.ui.open(OPEN)} />
        </Box>
        {theirs}
      </Box>
    )
  })
}

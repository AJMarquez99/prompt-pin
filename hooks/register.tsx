import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { PromptEntry } from '../types'
import { clip, clock, label, oneLine } from './format'

const PANE = 'prompt-pin'
const CAP = 100
const history = atom({ plugin: 'prompt-pin', key: 'history' } as const, [] as PromptEntry[])

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'prompts', description: "Show this session's prompts in a pane" })

    return next(e)
  })

  on('command.run', { command: 'prompts' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Prompts' })

    return { text: 'Prompts pane opened.' }
  })

  on('prompt.submit', async ($, e, next) => {
    const entry: PromptEntry = { text: e.text, at: await $.clock.now() }
    await update($, history, list => [...list, entry].slice(-CAP))

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = [...(await read($, history))].reverse()
    // Each entry takes up to 4 rows: 3 of text and a gap.
    const room = Math.max(1, Math.floor(((e.viewport?.rows ?? 24) - 2) / 4))
    const max = Math.max(20, e.props.bodyColumns * 3 - 8)

    return (
      <Box flexDirection="column">
        {list.length === 0 && <Text dimColor>No prompts yet.</Text>}
        {list.slice(0, room).map((entry, i) => (
          <Text key={`p${i}`} bold={i === 0} dimColor={i !== 0}>
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

    if (!e.props.isWorking || e.props.hasSurvey || latest === undefined) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)
    // Leave room for the button; the surface also truncates at the edge.
    const max = Math.max(10, e.props.bodyColumns - 14)

    return (
      <Box flexDirection="row">
        <Box flexGrow={1}>
          <Text wrap="truncate-end">
            📌 {clip(oneLine(label(latest.text)), max)}
          </Text>
        </Box>
        <Button key="history" label="History" onPress={() => $.ui.open({ id: PANE, title: 'Prompts' })} />
      </Box>
    )
  })
}

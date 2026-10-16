export type TurnOutcome = 'answer' | 'aborted' | 'refusal' | 'error'

// `at` is absent for a prompt rebuilt from the transcript after /resume or /branch.
// The turn fields are set once the prompt's turn starts, and `durationMs` when it ends.
export type PromptEntry = {
  text: string
  at?: number
  turnId?: string
  startedAt?: number
  durationMs?: number
  outcome?: TurnOutcome
}

// A turn that started before its prompt was recorded, waiting to be claimed by it.
export type TurnMark = { turnId: string; text: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'prompt-pin': { history: PromptEntry[]; pending: TurnMark | null; now: number }
  }
}

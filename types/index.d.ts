// `at` is absent for a prompt rebuilt from the transcript after /resume or /branch.
export type PromptEntry = { text: string; at?: number }

declare module 'claude-code' {
  interface PluginState {
    'prompt-pin': { history: PromptEntry[] }
  }
}

export type PromptEntry = { text: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'prompt-pin': { history: PromptEntry[] }
  }
}
